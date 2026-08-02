/**
 * Importa automaticamente os relatórios do AppBarber salvos em Downloads/AppBarber
 * e Downloads/AppBarber Financeiro.
 *
 * Convenção de pastas:
 *   Downloads/AppBarber/*.xlsx                        -> planilhas de COMISSÕES (têm a coluna "Profissional")
 *   Downloads/AppBarber/Ocupacao/<Nome>/*.xlsx         -> planilhas de TAXA DE OCUPAÇÃO (uma subpasta por profissional,
 *                                                         pois essa planilha não tem coluna de profissional)
 *   Downloads/AppBarber Financeiro/*.xlsx              -> planilha "Realizado" do DRE (sistema contábil)
 *
 * Uso:
 *   npm run import:appbarber          (roda uma vez e sai — use isso no Agendador de Tarefas do Windows)
 *   npm run import:appbarber -- --watch   (fica rodando e reprocessa a cada 30s — útil para deixar rodando manualmente)
 *
 * Após importar um arquivo com sucesso ele é APAGADO da pasta (não fica lixo acumulando).
 * Se der erro, o arquivo é mantido e o motivo aparece no console, para você revisar.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import * as xlsx from "xlsx";
import postgres from "postgres";
import {
  normalizeProfName,
  getPrimeiroNome,
  getMesAno,
  isPlanilhaOcupacao,
  parseComissoesRows,
  aggregateOcupacaoRows,
  buildTaxaOcupacaoPayload,
  DesempenhoProfissional,
} from "../src/lib/performance-data";
import { parseDreExcelRows } from "../src/lib/dre-data";

// Carrega o .env da raiz do projeto manualmente (este script roda fora do Next.js, que faz isso sozinho)
function loadEnvFile() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvFile();

const HOME = os.homedir();
const BASE_DIR = process.env.APPBARBER_WATCH_DIR || path.join(HOME, "Downloads", "AppBarber");
const OCUPACAO_DIR = path.join(BASE_DIR, "Ocupacao");
const FINANCEIRO_DIR = process.env.APPBARBER_FINANCEIRO_DIR || path.join(HOME, "Downloads", "AppBarber Financeiro");
const WATCH_INTERVAL_MS = 30_000;
const LOCK_PATH = path.join(BASE_DIR, ".import-lock");
const LOCK_STALE_MS = 5 * 60 * 1000; // se um lock ficar parado por mais que isso, é lixo de uma execução anterior que travou
const LOG_PATH = path.join(__dirname, "import-log.txt");

// Loga no console E grava direto em UTF-8 no arquivo (evita depender da captura de stream do PowerShell,
// que embaralha acentuação e formata mal os NativeCommandError quando roda via Agendador de Tarefas)
function log(msg: string) {
  console.log(msg);
  try { fs.appendFileSync(LOG_PATH, msg + "\n", "utf8"); } catch { /* log é best-effort */ }
}
function logError(msg: string) {
  console.error(msg);
  try { fs.appendFileSync(LOG_PATH, msg + "\n", "utf8"); } catch { /* log é best-effort */ }
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Evita duas execuções simultâneas brigarem pelo mesmo arquivo (ex: rodou o .bat manual
// enquanto a tarefa agendada também disparou) — isso causava ENOENT ao apagar o arquivo.
function acquireLock(): boolean {
  if (!fs.existsSync(BASE_DIR)) fs.mkdirSync(BASE_DIR, { recursive: true });
  if (fs.existsSync(LOCK_PATH)) {
    const age = Date.now() - fs.statSync(LOCK_PATH).mtimeMs;
    if (age < LOCK_STALE_MS) return false;
  }
  fs.writeFileSync(LOCK_PATH, String(process.pid));
  return true;
}

function releaseLock() {
  try { fs.unlinkSync(LOCK_PATH); } catch { /* já pode ter sido removido */ }
}

// Tenta apagar algumas vezes antes de desistir — cobre travas curtas do antivírus/indexador do Windows
async function unlinkWithRetry(filePath: string, attempts = 5, delayMs = 400) {
  for (let i = 0; i < attempts; i++) {
    try {
      fs.unlinkSync(filePath);
      return;
    } catch (err) {
      if (i === attempts - 1) throw err;
      await delay(delayMs);
    }
  }
}

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL não encontrada. Rode este script a partir da raiz do projeto (onde está o .env).");
  }
  const isPooler = url.includes("pooler.supabase.com") || url.includes(":6543") || url.includes("pgbouncer=true");
  return postgres(url, { ssl: "require", prepare: !isPooler, onnotice: () => {} });
}

type Sql = ReturnType<typeof getDb>;

async function ensureTables(sql: Sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS "DesempenhoProfissionalDB" (
      id TEXT PRIMARY KEY,
      profissional TEXT NOT NULL,
      item TEXT NOT NULL,
      data TEXT NOT NULL,
      "valorBruto" FLOAT NOT NULL,
      "valorComissao" FLOAT NOT NULL,
      pagamento TEXT,
      percentual FLOAT,
      cliente TEXT NOT NULL,
      pago BOOLEAN NOT NULL DEFAULT false,
      "mesAno" TEXT NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS "TaxaOcupacao" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      profissional TEXT NOT NULL,
      "mesAno" TEXT NOT NULL,
      "taxaOcupacao" FLOAT NOT NULL,
      "taxaOcupacaoComBloqueios" FLOAT NOT NULL,
      "tempoAtendimentoStr" TEXT NOT NULL,
      "tempoBloqueadoStr" TEXT NOT NULL,
      "tempoJornadaStr" TEXT NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(profissional, "mesAno")
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS "DreLinha" (
      id TEXT PRIMARY KEY,
      ano INTEGER NOT NULL,
      ordem INTEGER NOT NULL,
      resultado TEXT NOT NULL,
      "totalAno" FLOAT NOT NULL,
      jan FLOAT NOT NULL DEFAULT 0,
      fev FLOAT NOT NULL DEFAULT 0,
      mar FLOAT NOT NULL DEFAULT 0,
      abr FLOAT NOT NULL DEFAULT 0,
      mai FLOAT NOT NULL DEFAULT 0,
      jun FLOAT NOT NULL DEFAULT 0,
      jul FLOAT NOT NULL DEFAULT 0,
      ago FLOAT NOT NULL DEFAULT 0,
      "set" FLOAT NOT NULL DEFAULT 0,
      out FLOAT NOT NULL DEFAULT 0,
      nov FLOAT NOT NULL DEFAULT 0,
      dez FLOAT NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(ano, ordem)
    )
  `;
}

// Mesma lógica de upsert do POST /api/performance/comissoes (apaga o mês do profissional e reinsere)
async function upsertComissoes(sql: Sql, registros: DesempenhoProfissional[], mesAno: string, profissional: string) {
  const normProf = normalizeProfName(profissional);
  const firstProf = getPrimeiroNome(profissional);

  await sql`
    DELETE FROM "DesempenhoProfissionalDB"
    WHERE "mesAno" = ${mesAno}
      AND (profissional = ${normProf} OR profissional = ${firstProf} OR profissional ILIKE ${'%' + firstProf + '%'})
  `;

  for (const r of registros) {
    const rNormProf = normalizeProfName(r.profissional || normProf);
    await sql`
      INSERT INTO "DesempenhoProfissionalDB" (id, profissional, item, data, "valorBruto", "valorComissao", pagamento, percentual, cliente, pago, "mesAno")
      VALUES (${r.id}, ${rNormProf}, ${r.item}, ${r.data}, ${r.valorBruto}, ${r.valorComissao}, ${r.pagamento ?? null}, ${r.percentual ?? null}, ${r.cliente}, ${r.pago ?? false}, ${mesAno})
      ON CONFLICT (id) DO UPDATE SET
        profissional = EXCLUDED.profissional,
        item = EXCLUDED.item,
        data = EXCLUDED.data,
        "valorBruto" = EXCLUDED."valorBruto",
        "valorComissao" = EXCLUDED."valorComissao",
        pagamento = EXCLUDED.pagamento,
        percentual = EXCLUDED.percentual,
        cliente = EXCLUDED.cliente,
        pago = EXCLUDED.pago,
        "mesAno" = EXCLUDED."mesAno"
    `;
  }
}

// Mesma lógica de upsert do POST /api/performance/ocupacao
async function upsertOcupacao(sql: Sql, payload: ReturnType<typeof buildTaxaOcupacaoPayload>) {
  await sql`
    INSERT INTO "TaxaOcupacao" (id, profissional, "mesAno", "taxaOcupacao", "taxaOcupacaoComBloqueios", "tempoAtendimentoStr", "tempoBloqueadoStr", "tempoJornadaStr", "updatedAt")
    VALUES (
      gen_random_uuid()::text,
      ${payload.profissional}, ${payload.mesAno}, ${payload.taxaOcupacao}, ${payload.taxaOcupacaoComBloqueios},
      ${payload.tempoAtendimentoStr}, ${payload.tempoBloqueadoStr}, ${payload.tempoJornadaStr}, NOW()
    )
    ON CONFLICT (profissional, "mesAno") DO UPDATE SET
      "taxaOcupacao" = EXCLUDED."taxaOcupacao",
      "taxaOcupacaoComBloqueios" = EXCLUDED."taxaOcupacaoComBloqueios",
      "tempoAtendimentoStr" = EXCLUDED."tempoAtendimentoStr",
      "tempoBloqueadoStr" = EXCLUDED."tempoBloqueadoStr",
      "tempoJornadaStr" = EXCLUDED."tempoJornadaStr",
      "updatedAt" = NOW()
  `;
}

// Mesma lógica de upsert do POST /api/financeiro/dre — substitui o ano inteiro
// (o relatório "Realizado" é sempre um snapshot completo do ano até a data da exportação)
async function upsertDreAno(sql: Sql, ano: number, linhas: Omit<import("../src/lib/dre-data").DreLinhaImportada, "ordem">[]) {
  await sql`DELETE FROM "DreLinha" WHERE ano = ${ano}`;

  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    await sql`
      INSERT INTO "DreLinha" (id, ano, ordem, resultado, "totalAno", jan, fev, mar, abr, mai, jun, jul, ago, "set", out, nov, dez, "updatedAt")
      VALUES (${`${ano}-${i}`}, ${ano}, ${i}, ${l.resultado}, ${l.totalAno},
        ${l.jan}, ${l.fev}, ${l.mar}, ${l.abr}, ${l.mai}, ${l.jun}, ${l.jul}, ${l.ago}, ${l.set}, ${l.out}, ${l.nov}, ${l.dez}, NOW())
    `;
  }
}

function listPlanilhas(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => /\.(xlsx|xls|csv)$/i.test(f) && !f.startsWith("~$"))
    .map(f => path.join(dir, f));
}

function readSheet(filePath: string): any[] {
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return xlsx.utils.sheet_to_json(sheet);
}

async function processComissoesFile(sql: Sql, filePath: string) {
  const jsonData = readSheet(filePath);
  if (jsonData.length === 0) throw new Error("planilha vazia");
  if (isPlanilhaOcupacao(Object.keys(jsonData[0]))) {
    throw new Error("parece ser uma planilha de TAXA DE OCUPAÇÃO — mova para Downloads/AppBarber/Ocupacao/<Nome do Profissional>/");
  }

  const registros = parseComissoesRows(jsonData);
  if (registros.length === 0) throw new Error("nenhum registro de comissão reconhecido (colunas da planilha não batem com o esperado)");

  const grupos = new Map<string, { profissional: string; mesAno: string; items: DesempenhoProfissional[] }>();
  for (const r of registros) {
    const mesAno = getMesAno(r.data);
    const key = `${r.profissional}||${mesAno}`;
    if (!grupos.has(key)) grupos.set(key, { profissional: r.profissional, mesAno, items: [] });
    grupos.get(key)!.items.push(r);
  }

  for (const g of grupos.values()) {
    await upsertComissoes(sql, g.items, g.mesAno, g.profissional);
    log(`   -> ${g.profissional} (${g.mesAno}): ${g.items.length} registros`);
  }
}

async function processOcupacaoFile(sql: Sql, filePath: string, profissionalPasta: string) {
  const jsonData = readSheet(filePath);
  if (jsonData.length === 0) throw new Error("planilha vazia");
  if (!isPlanilhaOcupacao(Object.keys(jsonData[0]))) {
    throw new Error("não parece uma planilha de Taxa de Ocupação (colunas não batem com o esperado)");
  }

  const recordsPorMes = aggregateOcupacaoRows(jsonData);
  const meses = Object.keys(recordsPorMes);
  if (meses.length === 0) throw new Error("não foi possível calcular a jornada (valores zerados)");

  for (const mesAno of meses) {
    const totais = recordsPorMes[mesAno];
    if (totais.jornada <= 0) continue;
    const payload = buildTaxaOcupacaoPayload(profissionalPasta, mesAno, totais);
    await upsertOcupacao(sql, payload);
    log(`   -> ${payload.profissional} (${mesAno}): ${(payload.taxaOcupacao * 100).toFixed(1)}% de ocupação`);
  }
}

async function processFinanceiroFile(sql: Sql, filePath: string) {
  const wb = xlsx.readFile(filePath);
  const sheetName = wb.SheetNames.includes("Realizado") ? "Realizado" : wb.SheetNames[0];
  const jsonData = xlsx.utils.sheet_to_json(wb.Sheets[sheetName]);
  if (jsonData.length === 0) throw new Error("planilha vazia");

  const { ano, linhas } = parseDreExcelRows(jsonData);
  if (linhas.length === 0) throw new Error("nenhuma linha de DRE reconhecida (colunas da planilha não batem com o esperado)");

  await upsertDreAno(sql, ano, linhas);
  log(`   -> DRE ${ano}: ${linhas.length} linhas gravadas`);
}

async function runOnce(): Promise<{ processados: number; falhas: number; skipped?: boolean }> {
  if (!acquireLock()) {
    log("Outra execucao do importador ja esta rodando agora (lock ativo) - pulando esta rodada.");
    return { processados: 0, falhas: 0, skipped: true };
  }

  const sql = getDb();
  let processados = 0;
  let falhas = 0;

  try {
    await ensureTables(sql);

    // 1. Comissões — arquivos soltos direto em Downloads/AppBarber/
    for (const file of listPlanilhas(BASE_DIR)) {
      const nome = path.basename(file);
      try {
        log(`\n[comissoes] ${nome}`);
        await processComissoesFile(sql, file);
        await unlinkWithRetry(file);
        log(`   arquivo removido apos importacao`);
        processados++;
      } catch (err: any) {
        logError(`   ERRO: ${err.message} - arquivo mantido para revisao`);
        falhas++;
      }
    }

    // 2. Ocupação — uma subpasta por profissional
    if (fs.existsSync(OCUPACAO_DIR)) {
      for (const prof of fs.readdirSync(OCUPACAO_DIR)) {
        const profDir = path.join(OCUPACAO_DIR, prof);
        if (!fs.statSync(profDir).isDirectory()) continue;
        for (const file of listPlanilhas(profDir)) {
          const nome = path.basename(file);
          try {
            log(`\n[ocupacao/${prof}] ${nome}`);
            await processOcupacaoFile(sql, file, prof);
            await unlinkWithRetry(file);
            log(`   arquivo removido apos importacao`);
            processados++;
          } catch (err: any) {
            logError(`   ERRO: ${err.message} - arquivo mantido para revisao`);
            falhas++;
          }
        }
      }
    }

    // 3. Financeiro (DRE) — Downloads/AppBarber Financeiro/*.xlsx
    for (const file of listPlanilhas(FINANCEIRO_DIR)) {
      const nome = path.basename(file);
      try {
        log(`\n[financeiro] ${nome}`);
        await processFinanceiroFile(sql, file);
        await unlinkWithRetry(file);
        log(`   arquivo removido apos importacao`);
        processados++;
      } catch (err: any) {
        logError(`   ERRO: ${err.message} - arquivo mantido para revisao`);
        falhas++;
      }
    }
  } finally {
    await sql.end();
    releaseLock();
  }

  return { processados, falhas };
}

async function main() {
  const watchMode = process.argv.includes("--watch");

  log(`\n=== ${new Date().toLocaleString("pt-BR")} ===`);
  log(`Monitorando: ${BASE_DIR}`);
  log(`Ocupacao (por profissional): ${OCUPACAO_DIR}`);
  log(`Financeiro (DRE): ${FINANCEIRO_DIR}`);

  if (!watchMode) {
    const { processados, falhas } = await runOnce();
    log(`${processados} arquivo(s) importado(s), ${falhas} falha(s).`);
    process.exit(falhas > 0 && processados === 0 ? 1 : 0);
  }

  log(`Modo --watch: verificando a cada ${WATCH_INTERVAL_MS / 1000}s. Ctrl+C para parar.\n`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { processados, falhas, skipped } = await runOnce();
    if (processados > 0 || falhas > 0) {
      log(`${processados} arquivo(s) importado(s), ${falhas} falha(s). Aguardando novos arquivos...`);
    }
    await delay(skipped ? 5_000 : WATCH_INTERVAL_MS);
  }
}

main().catch(err => {
  logError(`Falha ao rodar o importador: ${err.message || err}`);
  releaseLock();
  process.exit(1);
});
