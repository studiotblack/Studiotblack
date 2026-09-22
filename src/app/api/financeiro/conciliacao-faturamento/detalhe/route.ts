import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";

export const dynamic = "force-dynamic";

// GET /api/financeiro/conciliacao-faturamento/detalhe?dia=16&mesAno=09/2026
// Drill-down de um dia "revisar" da conciliação AppBarber x Banco: lista os lançamentos
// individuais que compõem o lado "Banco" daquele dia, pra achar rápido qual entrada
// específica está puxando a diferença (ex: o PIX de R$20.500 que não era venda) sem precisar
// caçar manualmente na Conciliação Bancária.
export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ lancamentos: [] });
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const { searchParams } = new URL(request.url);
    const dia = searchParams.get("dia");
    const mesAno = searchParams.get("mesAno");
    if (!dia || !mesAno || !/^\d{2}\/\d{4}$/.test(mesAno)) {
      return NextResponse.json({ error: "dia e mesAno (MM/YYYY) são obrigatórios" }, { status: 400 });
    }
    const [mes, ano] = mesAno.split("/");
    const dataCompetencia = `${ano}-${mes}-${dia.padStart(2, "0")}`;

    const contas = await sql`
      SELECT "regraEntradaCategoriaId" FROM "ContaBancaria"
      WHERE ativa = true AND "regraEntradaAtiva" = true AND "regraEntradaCategoriaId" IS NOT NULL
    `;
    const categoriaIds = [...new Set(contas.map((c) => c.regraEntradaCategoriaId as string))];
    if (categoriaIds.length === 0) return NextResponse.json({ lancamentos: [] });

    const rows = await sql`
      SELECT
        a.id, a.tipo, a.valor, "valorPago", "dataCompetencia", "dataVencimento", a.descricao,
        c.nome AS "contatoNome",
        cat.nome AS "categoriaNome",
        cb.nome AS "contaBancariaNome"
      FROM "LancamentoFinanceiro" a
      JOIN "LancamentoFinanceiroCategoria" ac ON ac."lancamentoId" = a.id
      JOIN "CategoriaFinanceira" cat ON cat.id = ac."categoriaId"
      JOIN "Contato" c ON c.id = a."contatoId"
      LEFT JOIN "ContaBancaria" cb ON cb.id = a."contaBancariaId"
      WHERE a.tipo = 'receber'
        AND a."dataCompetencia" = ${dataCompetencia}
        AND ac."categoriaId" = ANY(${categoriaIds})
        AND a."valorPago" > 0
      ORDER BY a.valor DESC
    `;

    return NextResponse.json({ lancamentos: rows });
  } catch (error: any) {
    console.error("[GET /api/financeiro/conciliacao-faturamento/detalhe]", error);
    return NextResponse.json({ error: error?.message || "Erro ao buscar detalhe do dia" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
