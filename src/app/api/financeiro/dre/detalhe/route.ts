import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";

export const dynamic = "force-dynamic";

// GET /api/financeiro/dre/detalhe?codigo=1.1.1.01.001&mes=8&ano=2026
// Drill-down de uma linha do DRE: busca os lançamentos do NOSSO ledger (Contas a
// Pagar/Receber) cuja categoria tem o mesmo código contábil da linha do DRE, no mês
// de competência clicado. Só funciona pra lançamentos que passaram pelo sistema
// (Sicoob sincronizado ou cadastrados manualmente) — o "Realizado" importado do
// Excel é um total já fechado pelo contador, sem o detalhe transação a transação.
export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ lancamentos: [], totalNoSistema: 0 });
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const { searchParams } = new URL(request.url);
    const codigo = searchParams.get("codigo");
    const mes = searchParams.get("mes");
    const ano = searchParams.get("ano");

    if (!codigo || !mes || !ano) {
      return NextResponse.json({ error: "codigo, mes e ano são obrigatórios" }, { status: 400 });
    }

    const prefixoCompetencia = `${ano}-${mes.padStart(2, "0")}`;

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
      WHERE cat.codigo = ${codigo}
        AND a."dataCompetencia" LIKE ${prefixoCompetencia + "%"}
      ORDER BY a."dataCompetencia" ASC
    `;

    const totalNoSistema = rows.reduce((acc: number, r: any) => acc + (r.tipo === "receber" ? r.valor : -r.valor), 0);

    return NextResponse.json({ lancamentos: rows, totalNoSistema });
  } catch (error: any) {
    console.error("[GET /api/financeiro/dre/detalhe]", error);
    return NextResponse.json({ error: error?.message || "Erro ao buscar detalhe do DRE" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
