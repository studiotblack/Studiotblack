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
        l.descricao AS "lancamentoDescricao",
        comp."textoLegenda" AS "comprovanteLegenda",
        comp."categoriaSugeridaId",
        catSug.nome AS "categoriaSugeridaNome"
      FROM "TransacaoBancariaImportada" t
      LEFT JOIN "LancamentoFinanceiro" l ON l.id = t."lancamentoId"
      LEFT JOIN LATERAL (
        SELECT * FROM "WhatsappComprovante" wc
        WHERE wc.status = 'pendente'
          AND wc."valorOcr" IS NOT NULL
          AND t.tipo = 'saida'
          AND t.status = 'pendente'
          AND wc."valorOcr" BETWEEN t.valor - 0.02 AND t.valor + 0.02
        ORDER BY ABS(wc."dataHoraEnvio"::date - t.data::date)
        LIMIT 1
      ) comp ON true
      LEFT JOIN "CategoriaFinanceira" catSug ON catSug.id = comp."categoriaSugeridaId"
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
