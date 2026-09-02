import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/cron/sincronizar-manha — chamado todo dia às 8h (horário de Brasília) pelo
// Vercel Cron (ver vercel.json). Sincroniza o que dá pra sincronizar sem depender de
// login manual: extrato/saldo real do Sicoob de cada conta bancária cadastrada, e os
// comprovantes do grupo do WhatsApp. O DRE "Realizado" do Nibo continua manual — não
// existe uma API estável e sem login pra puxar isso automaticamente, então essa parte
// segue exigindo reimportar o Excel de vez em quando em Financeiro → Configuração DRE.
export async function GET(request: NextRequest) {
  // Vercel Cron manda esse header automaticamente quando CRON_SECRET está configurado
  // no projeto — sem a env var setada, roda sem checar (útil em dev/antes de configurar).
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Variável DATABASE_URL não configurada." }, { status: 500 });
  }

  const origem = new URL(request.url).origin;
  const resultado: any = { sicoob: [], whatsapp: null };

  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const contas = await sql`
      SELECT id, nome FROM "ContaBancaria"
      WHERE "sicoobClientId" IS NOT NULL AND "sicoobCertificado" IS NOT NULL
        AND "sicoobChavePrivada" IS NOT NULL AND "sicoobNumeroConta" IS NOT NULL
    `;

    for (const conta of contas) {
      try {
        const res = await fetch(`${origem}/api/financeiro/contas-bancarias/${conta.id}/sincronizar-sicoob`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json().catch(() => ({}));
        resultado.sicoob.push({ conta: conta.nome, ok: res.ok, ...data });
      } catch (err: any) {
        resultado.sicoob.push({ conta: conta.nome, ok: false, error: err?.message });
      }
    }
  } catch (err: any) {
    resultado.sicoob = [{ ok: false, error: err?.message || "Erro ao listar contas bancárias" }];
  } finally {
    await sql.end();
  }

  try {
    const res = await fetch(`${origem}/api/financeiro/whatsapp/sincronizar`, { method: "POST" });
    resultado.whatsapp = { ok: res.ok, ...(await res.json().catch(() => ({}))) };
  } catch (err: any) {
    resultado.whatsapp = { ok: false, error: err?.message };
  }

  return NextResponse.json({ executadoEm: new Date().toISOString(), ...resultado });
}
