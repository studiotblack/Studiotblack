import { NextResponse } from "next/server";
import { createWorker } from "tesseract.js";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";
import { coletarMensagensDoGrupo } from "@/lib/whatsapp/coletar-mensagens";
import { extrairValor } from "@/lib/whatsapp/extrair-valor";

export const dynamic = "force-dynamic";

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

    for (const msg of mensagens) {
      const msgId = msg.key.id;
      if (!msgId) continue;

      const [existente] = await sql`SELECT id FROM "WhatsappComprovante" WHERE "mensagemWhatsappId" = ${msgId}`;
      if (existente) { jaExistiam++; continue; }

      const caption = msg.message?.imageMessage?.caption || "";
      let valorOcr: number | null = extrairValor(caption);

      if (valorOcr === null) {
        try {
          const buffer = await downloadMediaMessage(msg, "buffer", {});
          const worker = await createWorker("por");
          const { data } = await worker.recognize(buffer);
          await worker.terminate();
          valorOcr = extrairValor(data.text);
        } catch (err) {
          console.error("[whatsapp/sincronizar] Erro no OCR:", err);
        }
      }

      const timestampSeg = typeof msg.messageTimestamp === "number" ? msg.messageTimestamp : Number(msg.messageTimestamp);
      const dataEnvio = new Date(timestampSeg * 1000);

      const [comprovante] = await sql`
        INSERT INTO "WhatsappComprovante"
          (id, "mensagemWhatsappId", "grupoId", remetente, "dataHoraEnvio", "textoLegenda", "valorOcr", "dataHoraOcr", status)
        VALUES
          (gen_random_uuid()::text, ${msgId}, ${grupoJid}, ${msg.pushName || null}, ${dataEnvio.toISOString()}, ${caption}, ${valorOcr}, NOW(), 'pendente')
        RETURNING *
      `;
      comprovantesNovos.push(comprovante);
    }

    // 3. Pra cada comprovante novo: SEMPRE decide a categoria sugerida pelo dicionário de
    // palavras-chave (mesmo sem transação correspondente ainda) — essa sugestão fica
    // salva e disponível na tela de Conciliação pra revisão manual. Só passa direto
    // (cria e baixa sozinho) quando for MATCH PERFEITO: achou a transação bancária pelo
    // valor/data E o dicionário reconheceu a categoria com confiança (não o fallback
    // genérico da conta, que é só sugestão de última instância pra revisão humana).
    const dicionario = await sql`SELECT * FROM "CategoriaPalavraChave"`;
    let vinculados = 0;
    let semCorrespondencia = 0;

    for (const comp of comprovantesNovos) {
      const legendaLower = (comp.textoLegenda || "").toLowerCase();
      let categoriaSugeridaId: string | null = null;
      for (const entrada of dicionario) {
        if (legendaLower.includes(String(entrada.palavraChave).toLowerCase())) {
          categoriaSugeridaId = entrada.categoriaId;
          break;
        }
      }
      await sql`UPDATE "WhatsappComprovante" SET "categoriaSugeridaId" = ${categoriaSugeridaId} WHERE id = ${comp.id}`;

      if (comp.valorOcr === null || comp.valorOcr === undefined) { semCorrespondencia++; continue; }

      const dataComp = new Date(comp.dataHoraEnvio).toISOString().slice(0, 10);
      const [transacao] = await sql`
        SELECT * FROM "TransacaoBancariaImportada"
        WHERE tipo = 'saida' AND status = 'pendente'
          AND valor BETWEEN ${comp.valorOcr - TOLERANCIA_VALOR} AND ${comp.valorOcr + TOLERANCIA_VALOR}
        ORDER BY ABS(data::date - ${dataComp}::date) ASC
        LIMIT 1
      `;
      if (!transacao) { semCorrespondencia++; continue; }
      if (!categoriaSugeridaId) { semCorrespondencia++; continue; }

      const [conta] = await sql`SELECT * FROM "ContaBancaria" WHERE id = ${transacao.contaBancariaId}`;
      const contatoId: string | null = conta?.regraSaidaContatoId ?? null;
      if (!conta?.regraSaidaAtiva || !contatoId) { semCorrespondencia++; continue; }

      await sql.begin(async (sql) => {
        const [novoLancamento] = await sql`
          INSERT INTO "LancamentoFinanceiro"
            (tipo, "contatoId", valor, "valorPago", "dataVencimento", "dataCompetencia", descricao, "contaBancariaId")
          VALUES
            ('pagar', ${contatoId}, ${transacao.valor}, ${transacao.valor}, ${transacao.data}, ${transacao.data}, ${comp.textoLegenda || transacao.descricao}, ${transacao.contaBancariaId})
          RETURNING *
        `;
        await sql`
          INSERT INTO "LancamentoFinanceiroCategoria" ("lancamentoId", "categoriaId", valor)
          VALUES (${novoLancamento.id}, ${categoriaSugeridaId}, ${transacao.valor})
        `;
        if (conta?.regraSaidaCentroCustoId) {
          await sql`
            INSERT INTO "LancamentoFinanceiroCentroCusto" ("lancamentoId", "centroCustoId", valor)
            VALUES (${novoLancamento.id}, ${conta.regraSaidaCentroCustoId}, ${transacao.valor})
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
    }

    return NextResponse.json({
      ok: true,
      mensagensLidas: mensagens.length,
      novos: comprovantesNovos.length,
      jaExistiam,
      vinculados,
      semCorrespondencia,
    });
  } catch (error: any) {
    console.error("[POST /api/financeiro/whatsapp/sincronizar]", error);
    return NextResponse.json({ error: error?.message || "Erro ao sincronizar WhatsApp" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
