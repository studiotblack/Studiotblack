import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";

export const dynamic = "force-dynamic";

// GET /api/financeiro/agendamentos?tipo=pagar|receber
export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json([], { status: 200 });
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get("tipo");

    const rows = await sql`
      SELECT
        a.*,
        c.nome AS "contatoNome",
        cb.nome AS "contaBancariaNome",
        cat.id AS "categoriaId",
        cat.nome AS "categoriaNome",
        cc.id AS "centroCustoId",
        cc.nome AS "centroCustoNome"
      FROM "LancamentoFinanceiro" a
      JOIN "Contato" c ON c.id = a."contatoId"
      LEFT JOIN "ContaBancaria" cb ON cb.id = a."contaBancariaId"
      LEFT JOIN "LancamentoFinanceiroCategoria" ac ON ac."lancamentoId" = a.id
      LEFT JOIN "CategoriaFinanceira" cat ON cat.id = ac."categoriaId"
      LEFT JOIN "LancamentoFinanceiroCentroCusto" acc ON acc."lancamentoId" = a.id
      LEFT JOIN "CentroCusto" cc ON cc.id = acc."centroCustoId"
      ${tipo ? sql`WHERE a.tipo = ${tipo}` : sql``}
      ORDER BY a."dataVencimento" ASC
    `;

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("[GET /api/financeiro/agendamentos]", error);
    return NextResponse.json({ error: error?.message || "Erro ao buscar agendamentos" }, { status: 500 });
  } finally {
    await sql.end();
  }
}

// POST /api/financeiro/agendamentos
export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Variável DATABASE_URL não configurada." }, { status: 500 });
  }
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const b = await request.json();

    if (!b.tipo || !b.contatoId || !b.valor || !b.dataVencimento || !b.dataCompetencia || !b.descricao) {
      return NextResponse.json({ error: "tipo, contatoId, valor, dataVencimento, dataCompetencia e descricao são obrigatórios" }, { status: 400 });
    }

    const agendamento = await sql.begin(async (sql) => {
      const [row] = await sql`
        INSERT INTO "LancamentoFinanceiro" (tipo, "contatoId", valor, "dataVencimento", "dataCompetencia", "dataPrevisao", descricao, referencia, detalhamento, "contaBancariaId", reembolsavel)
        VALUES (${b.tipo}, ${b.contatoId}, ${b.valor}, ${b.dataVencimento}, ${b.dataCompetencia}, ${b.dataPrevisao ?? null}, ${b.descricao}, ${b.referencia ?? null}, ${b.detalhamento ?? null}, ${b.contaBancariaId ?? null}, ${b.reembolsavel ?? false})
        RETURNING *
      `;

      if (b.categoriaId) {
        await sql`
          INSERT INTO "LancamentoFinanceiroCategoria" ("lancamentoId", "categoriaId", valor)
          VALUES (${row.id}, ${b.categoriaId}, ${b.valor})
        `;
      }
      if (b.centroCustoId) {
        await sql`
          INSERT INTO "LancamentoFinanceiroCentroCusto" ("lancamentoId", "centroCustoId", valor)
          VALUES (${row.id}, ${b.centroCustoId}, ${b.valor})
        `;
      }

      return row;
    });

    return NextResponse.json(agendamento);
  } catch (error: any) {
    console.error("[POST /api/financeiro/agendamentos]", error);
    return NextResponse.json({ error: error?.message || "Erro ao salvar agendamento" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
