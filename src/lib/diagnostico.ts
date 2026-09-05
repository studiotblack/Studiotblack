import type { Sql } from "@/lib/financeiro-db";

// Diagnóstico temporário do estouro de 60s do sync do WhatsApp em produção — os
// checkpoints de tempo com console.log não davam pra conferir sem navegar no painel da
// Vercel (e, se a função for morta de verdade no limite de 60s, o stdout bufferizado pode
// nem chegar a ser enviado pro agregador de logs a tempo). Gravando cada etapa direto no
// banco, cada INSERT já fica commitado no instante em que roda, sobrevive a um kill duro
// da função, e dá pra conferir com uma query — sem depender de nenhum acesso ao painel.
// Remover esta tabela e os usos dela depois que o 504 for resolvido de vez.
export async function ensureDiagnosticoTable(sql: Sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS "SyncDiagnostico" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "execucaoId" TEXT NOT NULL,
      etapa TEXT NOT NULL,
      "elapsedMs" INT NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
}

export type Logger = (etapa: string) => Promise<void>;

export function criarLogger(sql: Sql, execucaoId: string, inicio: number): Logger {
  return async (etapa: string) => {
    const elapsedMs = Date.now() - inicio;
    console.log(`[diagnostico:${execucaoId}] ${etapa} — ${(elapsedMs / 1000).toFixed(1)}s`);
    try {
      await sql`INSERT INTO "SyncDiagnostico" ("execucaoId", etapa, "elapsedMs") VALUES (${execucaoId}, ${etapa}, ${elapsedMs})`;
    } catch (err) {
      // o diagnóstico nunca pode derrubar a sincronização de verdade
      console.error("[diagnostico] erro ao gravar checkpoint:", err);
    }
  };
}
