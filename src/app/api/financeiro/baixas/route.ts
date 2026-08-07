import { NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";

export const dynamic = "force-dynamic";

// GET /api/financeiro/baixas — todas as baixas do sistema, com o tipo do agendamento
// (necessário pro painel de Fluxo de Caixa calcular saldo real por conta bancária)
export async function GET() {
  if (!process.env.DATABASE_URL) return NextResponse.json([], { status: 200 });
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const rows = await sql`
      SELECT b.*, a.tipo AS "agendamentoTipo"
      FROM "Baixa" b
      JOIN "LancamentoFinanceiro" a ON a.id = b."lancamentoId"
      ORDER BY b.data ASC
    `;
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("[GET /api/financeiro/baixas]", error);
    return NextResponse.json({ error: error?.message || "Erro ao buscar baixas" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
