import { NextResponse } from "next/server";
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

// Nenhuma chamada de rede/CPU externa (baixar a mídia do WhatsApp, chamar a API de OCR)
// tinha um teto de tempo próprio — o orçamento de TEMPO_LIMITE_MS abaixo só é checado
// ENTRE itens do loop, então se uma dessas chamadas travar de verdade no meio (ex: rede
// lenta/sem resposta), a função fica presa nela até o limite duro de 60s da Vercel. Corrida
// contra um timeout garante que NENHUMA chamada individual consiga travar a função inteira.
function comTimeout<T>(promise: Promise<T>, ms: number, mensagem: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(mensagem)), ms)),
  ]);
}

// OCR via API externa (OCR.space) em vez de rodar Tesseract.js dentro da função —
// createWorker() do Tesseract provou ser genuinamente instável na CPU da Vercel (chegou a
// levar mais de 40s pra ficar pronto, contra ~500ms local, mesmo já com o modelo de idioma
// local e um pré-aquecimento em paralelo com a conexão do WhatsApp — nada disso resolveu de
// verdade; confirmado em produção: 100% das tentativas recentes falharam por timeout). Uma
// chamada HTTP não tem esse cold-start de CPU, então troca o problema inteiro de categoria.
async function reconhecerTextoOcrSpace(buffer: Buffer): Promise<string> {
  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) throw new Error("OCR_SPACE_API_KEY não configurada");

  const form = new FormData();
  form.append("apikey", apiKey);
  form.append("language", "por");
  form.append("OCREngine", "2");
  form.append("scale", "true");
  form.append("file", new Blob([new Uint8Array(buffer)]), "comprovante.jpg");

  const res = await fetch("https://api.ocr.space/parse/image", { method: "POST", body: form });
  const data = await res.json();
  if (data.IsErroredOnProcessing) {
    const msg = Array.isArray(data.ErrorMessage) ? data.ErrorMessage.join("; ") : (data.ErrorMessage || "erro desconhecido");
    throw new Error(`OCR.space: ${msg}`);
  }
  return data.ParsedResults?.[0]?.ParsedText || "";
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

    // 2b. Baixa e guarda os BYTES da imagem de cada comprovante novo que precisa de OCR —
    // ANTES de tentar reconhecer o valor. Sem isso, o buffer só existia na memória desta
    // execução: se o OCR estourasse o orçamento de tempo (createWorker do Tesseract é
    // genuinamente instável na Vercel — já vimos de ~2s a mais de 40s pra ficar pronto,
    // no mesmo tipo de execução), a imagem se perdia pra sempre, porque o WhatsApp só
    // entrega cada mensagem uma vez. Guardando o buffer assim que baixa, uma sincronização
    // futura pode tentar de novo pra qualquer comprovante pendente com imagem salva — não
    // fica mais preso pra sempre só porque o worker não esquentou a tempo dessa vez.
    let downloadParouPorTempo = false;
    let imagensBaixadas = 0;
    for (const { msg, comprovanteId } of paraOcr) {
      if (tempoEsgotado()) { downloadParouPorTempo = true; break; }
      try {
        const buffer = await comTimeout(downloadMediaMessage(msg, "buffer", {}), 15_000, "download da mídia do WhatsApp travou (>15s)");
        await sql`UPDATE "WhatsappComprovante" SET "imagemBuffer" = ${buffer as Buffer} WHERE id = ${comprovanteId}`;
        imagensBaixadas++;
      } catch (err) {
        console.error("[whatsapp/sincronizar] Erro ao baixar imagem:", err);
        await log(`download da imagem ${comprovanteId} falhou — ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    await log(`depois de baixar imagens — ${imagensBaixadas} de ${paraOcr.length}${downloadParouPorTempo ? " (parou por orçamento de tempo)" : ""}`);

    // 2c. OCR só pra um número limitado de comprovantes por execução — busca direto no
    // banco (não só os coletados agora) pra incluir backlog de execuções anteriores que
    // tinham imagem salva mas não deu tempo/a API de OCR não respondeu. Prioriza os mais
    // antigos primeiro, pra nenhum ficar esperando pra sempre. Era 4 na época do Tesseract
    // (cada item podia levar >20s só pra iniciar o worker) — a API do OCR.space responde em
    // segundos, então dá pra processar bem mais por execução sem estourar o orçamento.
    const MAX_OCR_POR_EXECUCAO = 15;
    const candidatosOcr = await sql`
      SELECT id, "imagemBuffer" FROM "WhatsappComprovante"
      WHERE status = 'pendente' AND "valorOcr" IS NULL AND "imagemBuffer" IS NOT NULL
      ORDER BY "dataHoraEnvio" ASC
      LIMIT ${MAX_OCR_POR_EXECUCAO}
    `;
    let ocrProcessadas = 0;
    let ocrParouPorTempo = false;

    for (const cand of candidatosOcr) {
      if (tempoEsgotado()) { ocrParouPorTempo = true; break; }
      try {
        const texto = await comTimeout(reconhecerTextoOcrSpace(cand.imagemBuffer as Buffer), 15_000, "OCR.space travou (>15s)");
        const valorOcr = extrairValor(texto);
        // Sucesso: limpa o buffer guardado — não precisa mais dele, e não faz sentido
        // acumular imagem no banco além do necessário pra tentar de novo.
        await sql`UPDATE "WhatsappComprovante" SET "valorOcr" = ${valorOcr}, "textoOcr" = ${texto}, "dataHoraOcr" = NOW(), "imagemBuffer" = NULL WHERE id = ${cand.id}`;
        const item = comprovantesNovos.find((c) => c.id === cand.id);
        if (item) { item.valorOcr = valorOcr; item.textoOcr = texto; }
        ocrProcessadas++;
        await log(`OCR ${cand.id} concluído — valor: ${valorOcr}`);
      } catch (err) {
        console.error("[whatsapp/sincronizar] Erro no OCR:", err);
        await log(`OCR ${cand.id} falhou — ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    await log(`depois do OCR — ${ocrProcessadas} processada(s) de ${candidatosOcr.length}${ocrParouPorTempo ? " (parou por orçamento de tempo)" : ""}`);

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
      pausadoPorTempo: downloadParouPorTempo || ocrParouPorTempo || matchParouPorTempo,
    });
  } catch (error: any) {
    console.error("[POST /api/financeiro/whatsapp/sincronizar]", error);
    return NextResponse.json({ error: error?.message || "Erro ao sincronizar WhatsApp" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
