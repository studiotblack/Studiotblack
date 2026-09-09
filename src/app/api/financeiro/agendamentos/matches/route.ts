import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";

export const dynamic = "force-dynamic";

// Mesma tolerância de valor usada em ConciliacaoPanel.tsx (agendamentosCompativeis) pra
// sugerir o match no sentido contrário (transação -> agendamento) — aqui é o mesmo cálculo,
// só que partindo do agendamento pra achar a transação bancária compatível.
const TOLERANCIA_VALOR = 5;

// GET /api/financeiro/agendamentos/matches?tipo=pagar
// Pra cada agendamento em aberto do tipo pedido, acha a transação bancária pendente (saída
// pra "pagar", entrada pra "receber") cujo valor mais se aproxima do saldo em aberto — é a
// mesma sugestão que já existe na tela de Conciliação Bancária, só espelhada aqui pra dar
// pra ver e confirmar direto do Contas a Pagar, sem precisar trocar de tela. Nunca dá baixa
// sozinho: só retorna a sugestão, a confirmação continua manual (POST /transacoes-bancarias/[id]/conciliar).
export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json([]);
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get("tipo") || "pagar";
    const tipoTransacao = tipo === "pagar" ? "saida" : "entrada";

    const rows = await sql`
      SELECT DISTINCT ON (l.id)
        l.id AS "agendamentoId",
        t.id AS "transacaoId",
        t.valor AS "transacaoValor",
        t.data AS "transacaoData",
        t.descricao AS "transacaoDescricao",
        t."descricaoComplementar" AS "transacaoDescricaoComplementar"
      FROM "LancamentoFinanceiro" l
      JOIN "TransacaoBancariaImportada" t
        ON t.tipo = ${tipoTransacao}
        AND t.status = 'pendente'
        AND t.valor BETWEEN (l.valor - l."valorPago") - ${TOLERANCIA_VALOR} AND (l.valor - l."valorPago") + ${TOLERANCIA_VALOR}
      WHERE l.tipo = ${tipo} AND l."valorPago" < l.valor
      ORDER BY l.id,
        ABS(t.valor - (l.valor - l."valorPago")) ASC,
        ABS(t.data::date - COALESCE(l."dataVencimento", t.data)::date) ASC
    `;

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("[GET /api/financeiro/agendamentos/matches]", error);
    return NextResponse.json({ error: error?.message || "Erro ao buscar matches" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
