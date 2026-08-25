import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";

export const dynamic = "force-dynamic";

// GET /api/financeiro/agendamentos?tipo=&categoriaId=&centroCustoId=&contaBancariaId=&contatoId=&dataInicio=&dataFim=
// Todos os filtros são opcionais e combinam com AND — usado tanto na tela de Contas a
// Pagar/Receber (só tipo) quanto no Relatório Financeiro (todos os filtros disponíveis).
export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json([], { status: 200 });
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get("tipo");
    const categoriaId = searchParams.get("categoriaId");
    const centroCustoId = searchParams.get("centroCustoId");
    const contaBancariaId = searchParams.get("contaBancariaId");
    const contatoId = searchParams.get("contatoId");
    const dataInicio = searchParams.get("dataInicio");
    const dataFim = searchParams.get("dataFim");

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
      WHERE 1=1
        ${tipo ? sql`AND a.tipo = ${tipo}` : sql``}
        ${categoriaId ? sql`AND cat.id = ${categoriaId}` : sql``}
        ${centroCustoId ? sql`AND cc.id = ${centroCustoId}` : sql``}
        ${contaBancariaId ? sql`AND a."contaBancariaId" = ${contaBancariaId}` : sql``}
        ${contatoId ? sql`AND a."contatoId" = ${contatoId}` : sql``}
        ${dataInicio ? sql`AND a."dataVencimento" >= ${dataInicio}` : sql``}
        ${dataFim ? sql`AND a."dataVencimento" <= ${dataFim}` : sql``}
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

    if (!b.tipo || !b.contatoId || b.valor === undefined || b.valor === null || b.valor < 0 || !b.dataCompetencia || !b.descricao) {
      return NextResponse.json({ error: "tipo, contatoId, valor, dataCompetencia e descricao são obrigatórios" }, { status: 400 });
    }

    const agendamento = await sql.begin(async (sql) => {
      const [row] = await sql`
        INSERT INTO "LancamentoFinanceiro" (tipo, "contatoId", valor, "dataVencimento", "dataCompetencia", "dataPrevisao", descricao, referencia, detalhamento, "contaBancariaId", recorrencia)
        VALUES (${b.tipo}, ${b.contatoId}, ${b.valor}, ${b.dataVencimento || null}, ${b.dataCompetencia}, ${b.dataPrevisao ?? null}, ${b.descricao}, ${b.referencia ?? null}, ${b.detalhamento ?? null}, ${b.contaBancariaId ?? null}, ${b.recorrencia ?? null})
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
