import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";

export const dynamic = "force-dynamic";

// Mesmo dia do mês seguinte, com o dia ajustado (clamp) se o mês seguinte for mais curto
// (ex: 31/01 -> 28 ou 29/02) — evita datas inválidas tipo 31 de fevereiro.
function proximoMes(dataStr: string): string {
  const [y, m, d] = dataStr.split("-").map(Number);
  const primeiroDiaProximoMes = new Date(y, m, 1); // mês m (0-indexado) já é o mês seguinte ao mês humano m
  const ultimoDiaProximoMes = new Date(primeiroDiaProximoMes.getFullYear(), primeiroDiaProximoMes.getMonth() + 1, 0).getDate();
  const dia = Math.min(d, ultimoDiaProximoMes);
  const yy = primeiroDiaProximoMes.getFullYear();
  const mm = primeiroDiaProximoMes.getMonth() + 1;
  return `${yy}-${String(mm).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function proximaSemana(dataStr: string): string {
  const [y, m, d] = dataStr.split("-").map(Number);
  const data = new Date(y, m - 1, d + 7);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function proximaData(dataStr: string, recorrencia: string): string {
  return recorrencia === "semanal" ? proximaSemana(dataStr) : proximoMes(dataStr);
}

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

      // Conta recorrente totalmente quitada — gera sozinha a próxima ocorrência (mesmo
      // contato/valor/categoria/centro de custo, uma semana ou um mês depois, conforme
      // configurado), pra não precisar recadastrar aluguel/água/comissão etc. na mão.
      let proximaOcorrencia = null;
      if ((agendamento.recorrencia === "semanal" || agendamento.recorrencia === "mensal") && novoValorPago >= agendamento.valor - 0.01) {
        const [novaOcorrencia] = await sql`
          INSERT INTO "LancamentoFinanceiro"
            (tipo, "contatoId", valor, "dataVencimento", "dataCompetencia", descricao, "contaBancariaId", recorrencia)
          VALUES (
            ${agendamento.tipo}, ${agendamento.contatoId}, ${agendamento.valor},
            ${agendamento.dataVencimento ? proximaData(agendamento.dataVencimento, agendamento.recorrencia) : null},
            ${proximaData(agendamento.dataCompetencia, agendamento.recorrencia)},
            ${agendamento.descricao}, ${agendamento.contaBancariaId}, ${agendamento.recorrencia}
          )
          RETURNING *
        `;
        const categoriasOriginais = await sql`SELECT "categoriaId", valor FROM "LancamentoFinanceiroCategoria" WHERE "lancamentoId" = ${id}`;
        for (const c of categoriasOriginais) {
          await sql`INSERT INTO "LancamentoFinanceiroCategoria" ("lancamentoId", "categoriaId", valor) VALUES (${novaOcorrencia.id}, ${c.categoriaId}, ${c.valor})`;
        }
        const centrosOriginais = await sql`SELECT "centroCustoId", valor FROM "LancamentoFinanceiroCentroCusto" WHERE "lancamentoId" = ${id}`;
        for (const c of centrosOriginais) {
          await sql`INSERT INTO "LancamentoFinanceiroCentroCusto" ("lancamentoId", "centroCustoId", valor) VALUES (${novaOcorrencia.id}, ${c.centroCustoId}, ${c.valor})`;
        }
        proximaOcorrencia = novaOcorrencia;
      }

      return { baixa, agendamento: agendamentoAtualizado, proximaOcorrencia };
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
