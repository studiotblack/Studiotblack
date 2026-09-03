import { NextResponse } from "next/server";
import { createWorker } from "tesseract.js";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";
import { coletarMensagensDoGrupo } from "@/lib/whatsapp/coletar-mensagens";
import { extrairValor, extrairParcelas, ehComprovanteCartao } from "@/lib/whatsapp/extrair-valor";

export const dynamic = "force-dynamic";
// Sem isso, o Vercel mata a função no limite padrão (10s no plano Hobby) bem antes dos
// ~30s que o coletarMensagensDoGrupo já leva só esperando o backlog do WhatsApp — a
// função nunca tinha chance de terminar, o que também ajuda a explicar o "trava".
export const maxDuration = 60;

// Tolerância de diferença de valor pra considerar "o mesmo pagamento" entre o que o OCR
// leu no comprovante e o que consta no extrato bancário já importado.
const TOLERANCIA_VALOR = 0.02;

// POST /api/financeiro/whatsapp/sincronizar
// Lê os comprovantes novos do grupo do WhatsApp configurado, tenta ler o valor de cada
// imagem via OCR, casa com uma transação de SAÍDA ainda pendente na Conciliação Bancária
// (por valor + data), decide a categoria pela legenda (dicionário de palavras-chave) e,
// quando encontra os dois, cria e já baixa o lançamento sozinho — mesmo espírito da regra
// de entrada automática, só que pro lado da saída.
export async function POST() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Variável DATABASE_URL não configurada." }, { status: 500 });
  }
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);

    const [config] = await sql`SELECT "whatsappGrupoJid" FROM "MetaFinanceira" WHERE id = 'default'`;
    const grupoJid: string | undefined = config?.whatsappGrupoJid;
    if (!grupoJid) {
      return NextResponse.json({ error: "Nenhum grupo do WhatsApp configurado ainda." }, { status: 400 });
    }

    const [sessaoPareada] = await sql`SELECT 1 FROM "WhatsappAuthState" WHERE chave = 'creds'`;
    if (!sessaoPareada) {
      return NextResponse.json({ error: "WhatsApp ainda não pareado. Rode o script de pareamento primeiro." }, { status: 400 });
    }

    // 1. Conecta e coleta as mensagens de imagem novas do grupo
    const mensagens = await coletarMensagensDoGrupo(sql, grupoJid);

    // 2. Processa cada uma: dedupe, OCR, grava WhatsappComprovante
    let jaExistiam = 0;
    const comprovantesNovos: any[] = [];

    // Um worker de OCR só, reaproveitado pra todas as imagens do lote — criar um novo por
    // imagem (como era antes) soma um cold-start caro (carregar o modelo de português) a
    // cada foto, o que em ambiente serverless comia boa parte do orçamento de 60s da
    // função e ajudava a estourar o timeout com 2+ comprovantes sem legenda reconhecida.
    let worker: Awaited<ReturnType<typeof createWorker>> | null = null;

    try {
      for (const msg of mensagens) {
        const msgId = msg.key.id;
        if (!msgId) continue;

        const [existente] = await sql`SELECT id FROM "WhatsappComprovante" WHERE "mensagemWhatsappId" = ${msgId}`;
        if (existente) { jaExistiam++; continue; }

        const caption = msg.message?.imageMessage?.caption || "";
        let valorOcr: number | null = extrairValor(caption);
        let textoOcr: string | null = null;

        if (valorOcr === null) {
          try {
            const buffer = await downloadMediaMessage(msg, "buffer", {});
            if (!worker) worker = await createWorker("por");
            const { data } = await worker.recognize(buffer);
            valorOcr = extrairValor(data.text);
            textoOcr = data.text;
          } catch (err) {
            console.error("[whatsapp/sincronizar] Erro no OCR:", err);
          }
        }

        const timestampSeg = typeof msg.messageTimestamp === "number" ? msg.messageTimestamp : Number(msg.messageTimestamp);
        const dataEnvio = new Date(timestampSeg * 1000);

        const [comprovante] = await sql`
          INSERT INTO "WhatsappComprovante"
            (id, "mensagemWhatsappId", "grupoId", remetente, "dataHoraEnvio", "textoLegenda", "valorOcr", "textoOcr", "dataHoraOcr", status)
          VALUES
            (gen_random_uuid()::text, ${msgId}, ${grupoJid}, ${msg.pushName || null}, ${dataEnvio.toISOString()}, ${caption}, ${valorOcr}, ${textoOcr}, NOW(), 'pendente')
          RETURNING *
        `;
        comprovantesNovos.push(comprovante);
      }
    } finally {
      if (worker) await worker.terminate();
    }

    // 3. Roda o match pra TODO comprovante ainda pendente (não só os capturados agora) —
    // um comprovante de uma sincronização anterior, cuja transação bancária correspondente
    // só veio a existir depois (ex: extrato do Sicoob importado num sync seguinte), merece
    // ser retestado, não fica preso pra sempre esperando um novo envio no WhatsApp.
    // SEMPRE decide a categoria sugerida pelo dicionário de palavras-chave (mesmo sem
    // transação correspondente ainda) — essa sugestão fica salva e disponível na tela de
    // Conciliação pra revisão manual. O MATCH de valor+data por si só já é confiável o
    // bastante pra criar e baixar o lançamento sozinho — não precisa mais exigir categoria
    // reconhecida: quando não souber a categoria, usa o contato genérico de fallback e
    // copia a legenda do WhatsApp pra descrição, deixando pra revisão humana só ajustar a
    // categoria depois (a transação já não fica solta).
    const dicionario = await sql`SELECT * FROM "CategoriaPalavraChave"`;
    const [contatoFallback] = await sql`SELECT id FROM "Contato" WHERE nome = 'Fornecedor Diversos (WhatsApp)' LIMIT 1`;
    const comprovantesPendentes = await sql`SELECT * FROM "WhatsappComprovante" WHERE status = 'pendente'`;
    let vinculados = 0;
    let semCorrespondencia = 0;
    let cartaoRegistrado = 0;

    // Conta(s) que têm o dia de vencimento da fatura configurado — só dá pra decidir sozinho
    // qual conta uma compra pertence quando existe exatamente uma; com mais de uma, fica sem
    // conta (contaBancariaId null) pra revisão manual na tela de Conciliação.
    const contasComCartao = await sql`SELECT id, "cartaoDiaVencimento" FROM "ContaBancaria" WHERE "cartaoDiaVencimento" IS NOT NULL`;
    const contaCartaoUnica = contasComCartao.length === 1 ? contasComCartao[0] : null;

    // Primeira data (>= dataCompra) em que o dia-do-mês bate com o vencimento da fatura —
    // é o ciclo em que a parcela 1 vai debitar. Parcelas seguintes somam 1 mês cada.
    const primeiraOcorrenciaFatura = (dataCompra: Date, diaVencimento: number): Date => {
      const candidato = new Date(dataCompra.getFullYear(), dataCompra.getMonth(), diaVencimento);
      return candidato >= dataCompra ? candidato : new Date(dataCompra.getFullYear(), dataCompra.getMonth() + 1, diaVencimento);
    };
    const mesReferenciaDe = (base: Date, offsetMeses: number): string => {
      const d = new Date(base.getFullYear(), base.getMonth() + offsetMeses, 1);
      return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    };
    // Lista detalhada do que rolou com cada comprovante — sem isso, o resumo só dizia "1
    // vinculado, 1 sem correspondência" sem dizer QUAL comprovante, com QUE valor/legenda,
    // pra QUE categoria/contato, o que não dava pra conferir de verdade.
    const detalhes: Array<{ legenda: string | null; valor: number | null; dataEnvio: string; status: string; categoria: string | null; contato: string | null }> = [];

    for (const comp of comprovantesPendentes) {
      const legendaLower = (comp.textoLegenda || "").toLowerCase();
      let categoriaSugeridaId: string | null = null;
      for (const entrada of dicionario) {
        if (legendaLower.includes(String(entrada.palavraChave).toLowerCase())) {
          categoriaSugeridaId = entrada.categoriaId;
          break;
        }
      }
      await sql`UPDATE "WhatsappComprovante" SET "categoriaSugeridaId" = ${categoriaSugeridaId} WHERE id = ${comp.id}`;

      // Compra no cartão de crédito, marcada manualmente pelo usuário (legenda com "cartao")
      // — nunca vai bater 1:1 com uma transação bancária (a fatura só debita em uma saída só,
      // somando várias compras, lá na frente), então em vez de tentar o match normal, acumula
      // a(s) parcela(s) na "caixinha" (CompraCartaoCredito) pra reconciliar com a fatura depois.
      if (ehComprovanteCartao(comp.textoLegenda)) {
        const parcelasInfo =
          extrairParcelas(comp.textoLegenda) ??
          extrairParcelas(comp.textoOcr) ??
          (comp.valorOcr ? { parcelas: 1, valorParcela: comp.valorOcr } : null);

        if (!parcelasInfo) {
          semCorrespondencia++;
          detalhes.push({ legenda: comp.textoLegenda, valor: null, dataEnvio: comp.dataHoraEnvio, status: "cartão marcado, mas sem valor reconhecido (revisar manualmente)", categoria: null, contato: null });
          await sql`UPDATE "WhatsappComprovante" SET status = 'erro_cartao' WHERE id = ${comp.id}`;
          continue;
        }

        const dataCompra = new Date(comp.dataHoraEnvio);
        const primeiraParcela = contaCartaoUnica
          ? primeiraOcorrenciaFatura(dataCompra, contaCartaoUnica.cartaoDiaVencimento)
          : dataCompra;

        for (let p = 1; p <= parcelasInfo.parcelas; p++) {
          await sql`
            INSERT INTO "CompraCartaoCredito"
              ("whatsappComprovanteId", "contaBancariaId", descricao, "valorParcela", "parcelaNumero", "parcelaTotal", "mesReferencia")
            VALUES
              (${comp.id}, ${contaCartaoUnica?.id ?? null}, ${comp.textoLegenda}, ${parcelasInfo.valorParcela}, ${p}, ${parcelasInfo.parcelas}, ${mesReferenciaDe(primeiraParcela, p - 1)})
          `;
        }
        await sql`UPDATE "WhatsappComprovante" SET status = 'cartao_registrado' WHERE id = ${comp.id}`;
        cartaoRegistrado++;
        detalhes.push({
          legenda: comp.textoLegenda,
          valor: parcelasInfo.valorParcela,
          dataEnvio: comp.dataHoraEnvio,
          status: parcelasInfo.parcelas > 1
            ? `cartão: ${parcelasInfo.parcelas}x de ${parcelasInfo.valorParcela} — acumulado, aguardando fatura`
            : "cartão: acumulado, aguardando fatura",
          categoria: null,
          contato: null,
        });
        continue;
      }

      if (comp.valorOcr === null || comp.valorOcr === undefined) {
        semCorrespondencia++;
        detalhes.push({ legenda: comp.textoLegenda, valor: null, dataEnvio: comp.dataHoraEnvio, status: "sem correspondência (valor não reconhecido)", categoria: null, contato: null });
        continue;
      }

      const dataComp = new Date(comp.dataHoraEnvio).toISOString().slice(0, 10);
      const [transacao] = await sql`
        SELECT * FROM "TransacaoBancariaImportada"
        WHERE tipo = 'saida' AND status = 'pendente'
          AND valor BETWEEN ${comp.valorOcr - TOLERANCIA_VALOR} AND ${comp.valorOcr + TOLERANCIA_VALOR}
        ORDER BY ABS(data::date - ${dataComp}::date) ASC
        LIMIT 1
      `;
      if (!transacao) {
        semCorrespondencia++;
        detalhes.push({ legenda: comp.textoLegenda, valor: comp.valorOcr, dataEnvio: comp.dataHoraEnvio, status: "sem correspondência (nenhuma transação bancária com esse valor/data)", categoria: null, contato: null });
        continue;
      }

      // Regra aprendida de conciliação (a mesma que o Sicoob e a tela de Conciliação usam):
      // reconhece a contraparte do Pix pela descrição do banco e já traz contato/categoria/
      // centro de custo certos — prioridade sobre o dicionário de legenda (mais confiável,
      // porque reconhece o LUGAR, não um texto de legenda que muda a cada foto) e sobre o
      // fallback genérico.
      const descricaoLower = (transacao.descricao || "").toLowerCase();
      const complementarLower = (transacao.descricaoComplementar || "").toLowerCase();
      const [regra] = await sql`
        SELECT * FROM "RegraConciliacaoBancaria"
        WHERE ${descricaoLower} LIKE '%' || "padraoDescricao" || '%'
           OR ${complementarLower} LIKE '%' || "padraoDescricao" || '%'
        ORDER BY LENGTH("padraoDescricao") DESC
        LIMIT 1
      `;
      if (regra?.categoriaId) categoriaSugeridaId = regra.categoriaId;

      const [conta] = await sql`SELECT * FROM "ContaBancaria" WHERE id = ${transacao.contaBancariaId}`;
      const contatoId: string | null =
        regra?.contatoId ??
        (conta?.regraSaidaAtiva && conta?.regraSaidaContatoId ? conta.regraSaidaContatoId : contatoFallback?.id ?? null);
      if (!contatoId) {
        semCorrespondencia++;
        detalhes.push({ legenda: comp.textoLegenda, valor: comp.valorOcr, dataEnvio: comp.dataHoraEnvio, status: "sem correspondência (sem contato pra usar)", categoria: null, contato: null });
        continue;
      }

      await sql.begin(async (sql) => {
        const [novoLancamento] = await sql`
          INSERT INTO "LancamentoFinanceiro"
            (tipo, "contatoId", valor, "valorPago", "dataVencimento", "dataCompetencia", descricao, "contaBancariaId")
          VALUES
            ('pagar', ${contatoId}, ${transacao.valor}, ${transacao.valor}, ${transacao.data}, ${transacao.data}, ${regra?.descricao || comp.textoLegenda || transacao.descricao}, ${transacao.contaBancariaId})
          RETURNING *
        `;
        if (categoriaSugeridaId) {
          await sql`
            INSERT INTO "LancamentoFinanceiroCategoria" ("lancamentoId", "categoriaId", valor)
            VALUES (${novoLancamento.id}, ${categoriaSugeridaId}, ${transacao.valor})
          `;
        }
        const centroCustoId = regra?.centroCustoId ?? conta?.regraSaidaCentroCustoId;
        if (centroCustoId) {
          await sql`
            INSERT INTO "LancamentoFinanceiroCentroCusto" ("lancamentoId", "centroCustoId", valor)
            VALUES (${novoLancamento.id}, ${centroCustoId}, ${transacao.valor})
          `;
        }
        await sql`
          INSERT INTO "Baixa" ("lancamentoId", valor, data, "contaBancariaId", observacao)
          VALUES (${novoLancamento.id}, ${transacao.valor}, ${transacao.data}, ${transacao.contaBancariaId}, ${"Categorizado automaticamente via comprovante do WhatsApp"})
        `;
        await sql`
          UPDATE "TransacaoBancariaImportada" SET status = 'conciliado', "lancamentoId" = ${novoLancamento.id} WHERE id = ${transacao.id}
        `;
        await sql`
          UPDATE "WhatsappComprovante" SET status = 'vinculado', "transacaoBancariaId" = ${transacao.id} WHERE id = ${comp.id}
        `;
      });
      vinculados++;
      const [contatoNome] = await sql`SELECT nome FROM "Contato" WHERE id = ${contatoId}`;
      const categoriaNome = categoriaSugeridaId
        ? (await sql`SELECT nome FROM "CategoriaFinanceira" WHERE id = ${categoriaSugeridaId}`)[0]?.nome ?? null
        : null;
      detalhes.push({
        legenda: comp.textoLegenda,
        valor: transacao.valor,
        dataEnvio: comp.dataHoraEnvio,
        status: "vinculado",
        categoria: categoriaNome,
        contato: contatoNome?.nome ?? null,
      });
    }

    return NextResponse.json({
      ok: true,
      mensagensLidas: mensagens.length,
      novos: comprovantesNovos.length,
      jaExistiam,
      vinculados,
      semCorrespondencia,
      cartaoRegistrado,
      detalhes,
    });
  } catch (error: any) {
    console.error("[POST /api/financeiro/whatsapp/sincronizar]", error);
    return NextResponse.json({ error: error?.message || "Erro ao sincronizar WhatsApp" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
