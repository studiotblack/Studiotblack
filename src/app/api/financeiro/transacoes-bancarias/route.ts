import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";

export const dynamic = "force-dynamic";

// GET /api/financeiro/transacoes-bancarias?contaBancariaId=&mes=&ano=
export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json([], { status: 200 });
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const { searchParams } = new URL(request.url);
    const contaBancariaId = searchParams.get("contaBancariaId");
    const mes = searchParams.get("mes");
    const ano = searchParams.get("ano");

    const filtroMes = mes && ano ? `${ano}-${mes.padStart(2, "0")}` : null;

    const rows = await sql`
      SELECT
        t.*,
        l.descricao AS "lancamentoDescricao"
      FROM "TransacaoBancariaImportada" t
      LEFT JOIN "LancamentoFinanceiro" l ON l.id = t."lancamentoId"
      WHERE 1=1
        ${contaBancariaId ? sql`AND t."contaBancariaId" = ${contaBancariaId}` : sql``}
        ${filtroMes ? sql`AND t.data LIKE ${filtroMes + "%"}` : sql``}
      ORDER BY t.data DESC, t."createdAt" DESC
    `;

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("[GET /api/financeiro/transacoes-bancarias]", error);
    return NextResponse.json({ error: error?.message || "Erro ao buscar transações bancárias" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
