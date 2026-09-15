import { NextResponse } from "next/server";
import { createWorker } from "tesseract.js";
import path from "node:path";
import fs from "node:fs";
import { downloadMediaMessage, type WAMessage } from "@whiskeysockets/baileys";
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

// Sem "langPath" explícito, o tesseract.js baixa o modelo de idioma (~8MB) de um CDN
// externo (jsdelivr) TODA VEZ que cria o worker — foi isso, não o reconhecimento em si,
// que consumia 30-40s e matava a função pelo limite de 60s da Vercel (confirmado: todo
// comprovante pendente tinha textoOcr NULO, ou seja, o OCR nunca chegava a terminar nem
// uma vez). Apontar pro pacote @tesseract.js-data/por já instalado localmente elimina
// essa rede por completo — mas como esse caminho só existe como string aqui (nunca é
// importado via require/import), precisa do outputFileTracingIncludes em next.config.ts
// pra Vercel incluir esses arquivos no deploy; senão o build "esquece" deles.
const TESSERACT_LANG_PATH = path.join(process.cwd(), "node_modules", "@tesseract.js-data", "por", "4.0.0_best_int");

// Nenhuma chamada de rede/CPU externa (baixar a mídia do WhatsApp, criar o worker do
// Tesseract, rodar o reconhecimento) tinha um teto de tempo próprio — o orçamento de
// TEMPO_LIMITE_MS abaixo só é checado ENTRE itens do loop, então se uma dessas chamadas
// travar de verdade no meio (ex: CDN de mídia do WhatsApp lenta/sem resposta), a função
// fica presa nela até o limite duro de 60s da Vercel, do mesmo jeito que o download do
// modelo do Tesseract travava antes. Corrida contra um timeout garante que NENHUMA
// chamada individual consiga travar a função inteira, não importa o motivo.
function comTimeout<T>(promise: Promise<T>, ms: number, mensagem: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(mensagem)), ms)),
  ]);
}

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

    // 2a. Grava TODAS as mensagens novas imediatamente — só regex na legenda (extrairValor),
    // sem baixar mídia nem rodar OCR ainda. Isso é rápido de propósito: uma mensagem do
    // WhatsApp só chega UMA vez (não tem como "pedir de novo" depois); se a função for
    // morta pela Vercel no meio do processamento antes de gravar uma mensagem, ela some
    // pra sempre. Gravando primeiro (rápido) e rodando o OCR depois (mais lento, com
    // limite), na pior das hipóteses um comprovante fica esperando o valor ser preenchido
    // à mão — mas nunca desaparece.
    let jaExistiam = 0;
    const comprovantesNovos: any[] = [];
    const paraOcr: { msg: WAMessage; comprovanteId: string }[] = [];

    for (const msg of mensagens) {
      const msgId = msg.key.id;
      if (!msgId) continue;

      const [existente] = await sql`SELECT id FROM "WhatsappComprovante" WHERE "mensagemWhatsappId" = ${msgId}`;
      if (existente) { jaExistiam++; continue; }

      const caption = msg.message?.imageMessage?.caption || "";
      const valorOcr = extrairValor(caption);
      const timestampSeg = typeof msg.messageTimestamp === "number" ? msg.messageTimestamp : Number(msg.messageTimestamp);
      const dataEnvio = new Date(timestampSeg * 1000);

      const [comprovante] = await sql`
        INSERT INTO "WhatsappComprovante"
          (id, "mensagemWhatsappId", "grupoId", remetente, "dataHoraEnvio", "textoLegenda", "valorOcr", status)
        VALUES
          (gen_random_uuid()::text, ${msgId}, ${grupoJid}, ${msg.pushName || null}, ${dataEnvio.toISOString()}, ${caption}, ${valorOcr}, 'pendente')
        RETURNING *
      `;
      comprovantesNovos.push(comprovante);
      if (valorOcr === null) paraOcr.push({ msg, comprovanteId: comprovante.id });
    }
    await log(`depois de gravar os novos — ${comprovantesNovos.length} novo(s), ${jaExistiam} já existia(m), ${paraOcr.length} precisam de OCR`);

    // Orçamento de tempo pro que falta rodar (OCR + loop de match) — sem isso, o
    // MAX_OCR_POR_EXECUCAO abaixo não protege nada: já vimos em produção uma execução só
    // com a conexão do WhatsApp consumir ~23s, e o Tesseract sozinho (cold start do worker
    // + reconhecimento) estourar os ~37s restantes processando UMA imagem só, matando a
    // função no limite duro de 60s da Vercel (o cliente recebe um 504 com corpo que não é
    // JSON, sem nenhum log daqui pra frente). 45s deixa ~15s de folga real pro resto rodar
    // e a resposta ser serializada — cada loop abaixo checa esse relógio a cada iteração e
    // para de propósito, devolvendo uma resposta 200 válida com o que deu tempo de fazer,
    // em vez de arriscar ser morto sem aviso.
    const TEMPO_LIMITE_MS = 45_000;
    const tempoEsgotado = () => Date.now() - inicio > TEMPO_LIMITE_MS;

    // 2b. OCR só pra um número limitado de imagens por execução — as que sobrarem já estão
    // salvas (passo acima), só ficam sem valor reconhecido automaticamente até o usuário
    // preencher na tela "Comprovantes do WhatsApp sem resolver" (não tem como tentar de novo
    // sozinho numa sincronização futura: a mensagem original do WhatsApp só existe em
    // memória durante ESTA execução).
    const MAX_OCR_POR_EXECUCAO = 4;
    const paraProcessar = paraOcr.slice(0, MAX_OCR_POR_EXECUCAO);
    let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
    let ocrProcessadas = 0;
    let ocrParouPorTempo = false;

    // Confirmado (build local): o arquivo do modelo de português ESTÁ no manifesto de
    // rastreamento de arquivos da rota (.nft.json), então outputFileTracingIncludes está
    // funcionando. Mas createWorker ainda estava travando (>10s) em produção mesmo assim —
    // preciso saber SE é porque o caminho monta errado no ambiente da Vercel (process.cwd()
    // pode resolver diferente lá) ou se é só o cold start do worker_thread sendo genuinamente
    // mais lento que no meu ambiente local. Esse log tira a dúvida na próxima execução real,
    // em vez de eu continuar mudando código às cegas.
    if (paraProcessar.length > 0) {
      const arquivoModelo = path.join(TESSERACT_LANG_PATH, "por.traineddata.gz");
      await log(`diagnóstico langPath — cwd: ${process.cwd()} | langPath existe: ${fs.existsSync(TESSERACT_LANG_PATH)} | arquivo do modelo existe: ${fs.existsSync(arquivoModelo)}`);
    }
    try {
      for (const { msg, comprovanteId } of paraProcessar) {
        if (tempoEsgotado()) { ocrParouPorTempo = true; break; }
        try {
          const buffer = await comTimeout(downloadMediaMessage(msg, "buffer", {}), 15_000, "download da mídia do WhatsApp travou (>15s)");
          if (!worker) worker = await comTimeout(createWorker("por", undefined, { langPath: TESSERACT_LANG_PATH, cacheMethod: "none" }), 20_000, "criação do worker do Tesseract travou (>20s)");
          const { data } = await comTimeout(worker.recognize(buffer), 15_000, "reconhecimento OCR travou (>15s)");
          const valorOcr = extrairValor(data.text);
          await sql`UPDATE "WhatsappComprovante" SET "valorOcr" = ${valorOcr}, "textoOcr" = ${data.text}, "dataHoraOcr" = NOW() WHERE id = ${comprovanteId}`;
          const item = comprovantesNovos.find((c) => c.id === comprovanteId);
          if (item) { item.valorOcr = valorOcr; item.textoOcr = data.text; }
          ocrProcessadas++;
          await log(`OCR ${comprovanteId} concluído — valor: ${valorOcr}`);
        } catch (err) {
          console.error("[whatsapp/sincronizar] Erro no OCR:", err);
          await log(`OCR ${comprovanteId} falhou — ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } finally {
      if (worker) await worker.terminate();
    }
    await log(`depois do OCR — ${ocrProcessadas} processada(s) de ${paraProcessar.length}${ocrParouPorTempo ? " (parou por orçamento de tempo)" : ""}`);

    // 3. Roda o match pra TODO comprovante ainda pendente (não só os capturados agora) —
    // um comprovante de uma sincronização anterior, cuja transação bancária correspondente
    // só veio a existir depois (ex: extrato do Sicoob importado num sync seguinte), merece
    // ser retestado, não fica preso pra sempre esperando um novo envio no WhatsApp.
    const comprovantesPendentes = await sql`SELECT * FROM "WhatsappComprovante" WHERE status = 'pendente'`;
    await log(`antes do loop de match — ${comprovantesPendentes.length} comprovante(s) pendente(s)`);
    let vinculados = 0;
    let semCorrespondencia = 0;
    let cartaoRegistrado = 0;
    let matchParouPorTempo = false;

    // Lista detalhada do que rolou com cada comprovante — sem isso, o resumo só dizia "1
    // vinculado, 1 sem correspondência" sem dizer QUAL comprovante, com QUE valor/legenda,
    // pra QUE categoria/contato, o que não dava pra conferir de verdade.
    const detalhes: Array<{ legenda: string | null; valor: number | null; dataEnvio: string; status: string; categoria: string | null; contato: string | null }> = [];

    for (const comp of comprovantesPendentes) {
      if (tempoEsgotado()) { matchParouPorTempo = true; break; }
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

    await log(`fim do loop de match${matchParouPorTempo ? " (parou por orçamento de tempo)" : ""} — respondendo`);
    return NextResponse.json({
      ok: true,
      mensagensLidas: mensagens.length,
      novos: comprovantesNovos.length,
      jaExistiam,
      vinculados,
      semCorrespondencia,
      cartaoRegistrado,
      detalhes,
      // Sinaliza que sobrou trabalho pra próxima sincronização (OCR ou match cortados pelo
      // orçamento de tempo) — sem isso, o usuário não tem como saber que "deu certo, mas
      // incompleto" e não "travou nada".
      pausadoPorTempo: ocrParouPorTempo || matchParouPorTempo,
    });
  } catch (error: any) {
    console.error("[POST /api/financeiro/whatsapp/sincronizar]", error);
    return NextResponse.json({ error: error?.message || "Erro ao sincronizar WhatsApp" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
