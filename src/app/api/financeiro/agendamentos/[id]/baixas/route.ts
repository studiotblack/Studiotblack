import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";

export const dynamic = "force-dynamic";

// POST /api/financeiro/agendamentos/[id]/baixas — registra pagamento/recebimento total ou parcial
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Variável DATABASE_URL não configurada." }, { status: 500 });
  }
  const { id } = await ctx.params;
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const b = await request.json();

    if (!b.valor || b.valor <= 0 || !b.data || !b.contaBancariaId) {
      return NextResponse.json({ error: "valor, data e contaBancariaId são obrigatórios" }, { status: 400 });
    }

    const resultado = await sql.begin(async (sql) => {
      const [agendamento] = await sql`SELECT * FROM "LancamentoFinanceiro" WHERE id = ${id}`;
      if (!agendamento) throw new Error("Agendamento não encontrado");

      const novoValorPago = agendamento.valorPago + b.valor;
      if (novoValorPago > agendamento.valor + 0.01) {
        throw new Error(`Valor da baixa (${b.valor}) excede o saldo em aberto (${(agendamento.valor - agendamento.valorPago).toFixed(2)})`);
      }

      const [baixa] = await sql`
        INSERT INTO "Baixa" ("lancamentoId", valor, data, "contaBancariaId", observacao)
        VALUES (${id}, ${b.valor}, ${b.data}, ${b.contaBancariaId}, ${b.observacao ?? null})
        RETURNING *
      `;

      const [agendamentoAtualizado] = await sql`
        UPDATE "LancamentoFinanceiro" SET "valorPago" = ${novoValorPago}, "updatedAt" = NOW()
        WHERE id = ${id}
        RETURNING *
      `;

      return { baixa, agendamento: agendamentoAtualizado };
    });

    return NextResponse.json(resultado);
  } catch (error: any) {
    console.error("[POST /api/financeiro/agendamentos/[id]/baixas]", error);
    return NextResponse.json({ error: error?.message || "Erro ao registrar baixa" }, { status: 500 });
  } finally {
    await sql.end();
  }
}

// GET /api/financeiro/agendamentos/[id]/baixas — histórico de baixas de um agendamento
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) return NextResponse.json([], { status: 200 });
  const { id } = await ctx.params;
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const rows = await sql`SELECT * FROM "Baixa" WHERE "lancamentoId" = ${id} ORDER BY data ASC`;
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Erro ao buscar baixas" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
