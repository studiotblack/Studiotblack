import { NextResponse } from "next/server";
import { createWorker } from "tesseract.js";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";
import { coletarMensagensDoGrupo } from "@/lib/whatsapp/coletar-mensagens";
import { extrairValor, extrairParcelas, ehComprovanteCartao } from "@/lib/whatsapp/extrair-valor";
import { registrarParcelasCartao } from "@/lib/whatsapp/cartao-credito";
import { tentarVincularComprovante } from "@/lib/whatsapp/vincular-comprovante";
import { ensureDiagnosticoTable, criarLogger } from "@/lib/diagnostico";

export const dynamic = "force-dynamic";
// Sem isso, o Vercel mata a função no limite padrão (10s no plano Hobby) bem antes dos
// ~30s que o coletarMensagensDoGrupo já leva só esperando o backlog do WhatsApp — a
// função nunca tinha chance de terminar, o que também ajuda a explicar o "trava".
export const maxDuration = 60;

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
  // Instrumentação de tempo, gravada no banco (não só console.log) — se a função for
  // morta de verdade no limite de 60s da Vercel, o stdout bufferizado pode nem chegar a
  // ser enviado pro agregador de logs a tempo; um INSERT já fica commitado na hora.
  const execucaoId = crypto.randomUUID();
  const inicio = Date.now();
  let log = (etapa: string) => { console.log(`[whatsapp/sincronizar:${execucaoId}] ${etapa} — ${((Date.now() - inicio) / 1000).toFixed(1)}s`); return Promise.resolve(); };
  try {
    await ensureDiagnosticoTable(sql);
    log = criarLogger(sql, execucaoId, inicio);
    await log("início da função");
    await ensureFinanceiroTables(sql);
    await log("depois de ensureFinanceiroTables");

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
    await log("antes de conectar no WhatsApp");
    const mensagens = await coletarMensagensDoGrupo(sql, grupoJid, log);
    await log(`depois de conectar — ${mensagens.length} mensagem(ns) coletada(s)`);

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
    await log(`depois do OCR/gravação dos novos — ${comprovantesNovos.length} novo(s), ${jaExistiam} já existia(m)`);

    // 3. Roda o match pra TODO comprovante ainda pendente (não só os capturados agora) —
    // um comprovante de uma sincronização anterior, cuja transação bancária correspondente
    // só veio a existir depois (ex: extrato do Sicoob importado num sync seguinte), merece
    // ser retestado, não fica preso pra sempre esperando um novo envio no WhatsApp.
    const comprovantesPendentes = await sql`SELECT * FROM "WhatsappComprovante" WHERE status = 'pendente'`;
    await log(`antes do loop de match — ${comprovantesPendentes.length} comprovante(s) pendente(s)`);
    let vinculados = 0;
    let semCorrespondencia = 0;
    let cartaoRegistrado = 0;

    // Lista detalhada do que rolou com cada comprovante — sem isso, o resumo só dizia "1
    // vinculado, 1 sem correspondência" sem dizer QUAL comprovante, com QUE valor/legenda,
    // pra QUE categoria/contato, o que não dava pra conferir de verdade.
    const detalhes: Array<{ legenda: string | null; valor: number | null; dataEnvio: string; status: string; categoria: string | null; contato: string | null }> = [];

    for (const comp of comprovantesPendentes) {
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

        await registrarParcelasCartao(sql, {
          whatsappComprovanteId: comp.id,
          descricao: comp.textoLegenda,
          dataCompra: new Date(comp.dataHoraEnvio),
          parcelas: parcelasInfo.parcelas,
          valorParcela: parcelasInfo.valorParcela,
        });
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

      const resultado = await tentarVincularComprovante(sql, comp);
      if (resultado.status === "vinculado") {
        vinculados++;
        detalhes.push({
          legenda: comp.textoLegenda,
          valor: resultado.valor,
          dataEnvio: comp.dataHoraEnvio,
          status: "vinculado",
          categoria: resultado.categoria,
          contato: resultado.contato,
        });
      } else {
        semCorrespondencia++;
        detalhes.push({
          legenda: comp.textoLegenda,
          valor: comp.valorOcr,
          dataEnvio: comp.dataHoraEnvio,
          status: `sem correspondência (${resultado.motivo})`,
          categoria: null,
          contato: null,
        });
      }
    }

    await log("fim do loop de match — respondendo");
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
