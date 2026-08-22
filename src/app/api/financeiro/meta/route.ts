import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";

export const dynamic = "force-dynamic";

// GET /api/financeiro/meta — meta de faturamento mensal do negócio (linha única)
export async function GET() {
  if (!process.env.DATABASE_URL) return NextResponse.json({ metaReceitaMensal: 0 });
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const [row] = await sql`SELECT "metaReceitaMensal" FROM "MetaFinanceira" WHERE id = 'default'`;
    return NextResponse.json({ metaReceitaMensal: row?.metaReceitaMensal ?? 0 });
  } catch (error: any) {
    console.error("[GET /api/financeiro/meta]", error);
    return NextResponse.json({ error: error?.message || "Erro ao buscar meta" }, { status: 500 });
  } finally {
    await sql.end();
  }
}

// PUT /api/financeiro/meta — atualiza a meta de faturamento mensal
export async function PUT(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Variável DATABASE_URL não configurada." }, { status: 500 });
  }
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const { metaReceitaMensal } = await request.json();
    if (typeof metaReceitaMensal !== "number" || metaReceitaMensal < 0) {
      return NextResponse.json({ error: "metaReceitaMensal precisa ser um número válido" }, { status: 400 });
    }
    const [row] = await sql`
      INSERT INTO "MetaFinanceira" (id, "metaReceitaMensal", "updatedAt")
      VALUES ('default', ${metaReceitaMensal}, NOW())
      ON CONFLICT (id) DO UPDATE SET "metaReceitaMensal" = EXCLUDED."metaReceitaMensal", "updatedAt" = NOW()
      RETURNING "metaReceitaMensal"
    `;
    return NextResponse.json({ metaReceitaMensal: row.metaReceitaMensal });
  } catch (error: any) {
    console.error("[PUT /api/financeiro/meta]", error);
    return NextResponse.json({ error: error?.message || "Erro ao salvar meta" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
