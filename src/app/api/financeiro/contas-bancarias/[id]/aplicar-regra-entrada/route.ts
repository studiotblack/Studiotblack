import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";

export const dynamic = "force-dynamic";

// POST /api/financeiro/contas-bancarias/[id]/aplicar-regra-entrada
// Aplica retroativamente a regra de entrada automática da conta em cima das transações
// de ENTRADA que já estão "pendente" (importadas antes da regra existir, ou de quando ela
// ainda estava desligada) — cria e já baixa um lançamento de "conta a receber" pra cada uma,
// com o contato/categoria/centro de custo padrão configurados na conta.
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Variável DATABASE_URL não configurada." }, { status: 500 });
  }
  const { id } = await ctx.params;
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);

    const [conta] = await sql`SELECT * FROM "ContaBancaria" WHERE id = ${id}`;
    if (!conta) return NextResponse.json({ error: "Conta bancária não encontrada" }, { status: 404 });
    if (!conta.regraEntradaAtiva || !conta.regraEntradaContatoId) {
      return NextResponse.json({ error: "Esta conta não tem a regra de entrada automática ativa. Configure em Cadastros → Contas Bancárias." }, { status: 400 });
    }

    const pendentes = await sql`
      SELECT * FROM "TransacaoBancariaImportada"
      WHERE "contaBancariaId" = ${id} AND tipo = 'entrada' AND status = 'pendente'
    `;

    // Marcador único pra reconhecer o erro de "outra execução já processou essa transação"
    // dentro do catch abaixo, sem confundir com um erro de verdade.
    const JA_PROCESSADO = "ja_processado_por_outra_execucao";

    let aplicados = 0;
    let jaProcessados = 0;
    for (const t of pendentes) {
      try {
        await sql.begin(async (sql) => {
          const [novoLancamento] = await sql`
            INSERT INTO "LancamentoFinanceiro"
              (tipo, "contatoId", valor, "valorPago", "dataVencimento", "dataCompetencia", descricao, "contaBancariaId")
            VALUES
              ('receber', ${conta.regraEntradaContatoId}, ${t.valor}, ${t.valor}, ${t.data}, ${t.data}, ${t.descricao}, ${id})
            RETURNING *
          `;
          if (conta.regraEntradaCategoriaId) {
            await sql`
              INSERT INTO "LancamentoFinanceiroCategoria" ("lancamentoId", "categoriaId", valor)
              VALUES (${novoLancamento.id}, ${conta.regraEntradaCategoriaId}, ${t.valor})
            `;
          }
          if (conta.regraEntradaCentroCustoId) {
            await sql`
              INSERT INTO "LancamentoFinanceiroCentroCusto" ("lancamentoId", "centroCustoId", valor)
              VALUES (${novoLancamento.id}, ${conta.regraEntradaCentroCustoId}, ${t.valor})
            `;
          }
          await sql`
            INSERT INTO "Baixa" ("lancamentoId", valor, data, "contaBancariaId", observacao)
            VALUES (${novoLancamento.id}, ${t.valor}, ${t.data}, ${id}, ${"Criado e conciliado retroativamente via regra de entrada Sicoob"})
          `;
          // Só confirma se a transação ainda estiver 'pendente' nesse exato instante — se
          // outra execução concorrente já tiver conciliado ela primeiro, a condição não bate
          // nenhuma linha e a gente desfaz (throw) tudo que criou acima, em vez de deixar um
          // lançamento duplicado órfão (foi exatamente isso que gerou 8 duplicatas antes desse fix).
          const [reservada] = await sql`
            UPDATE "TransacaoBancariaImportada" SET status = 'conciliado', "lancamentoId" = ${novoLancamento.id}
            WHERE id = ${t.id} AND status = 'pendente'
            RETURNING id
          `;
          if (!reservada) throw new Error(JA_PROCESSADO);
        });
        aplicados++;
      } catch (err) {
        if (err instanceof Error && err.message === JA_PROCESSADO) {
          jaProcessados++;
          continue;
        }
        throw err;
      }
    }

    return NextResponse.json({ ok: true, aplicados, jaProcessados, totalPendentesAntes: pendentes.length });
  } catch (error: any) {
    console.error("[POST /api/financeiro/contas-bancarias/[id]/aplicar-regra-entrada]", error);
    return NextResponse.json({ error: error?.message || "Erro ao aplicar regra de entrada" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
