import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";

export const dynamic = "force-dynamic";

// POST /api/financeiro/contas-bancarias/[id]/aplicar-regras-saida
// Aplica retroativamente TODAS as regras de conciliação já aprendidas (RegraConciliacaoBancaria)
// em cima das transações de SAÍDA que ainda estão "pendente" — sem isso, ensinar um padrão novo
// só valia pra pagamentos FUTUROS do mesmo lugar; os antigos que já estavam parados esperando
// revisão manual continuavam parados. Roda em cima de TODOS os pendentes da conta, sem filtro
// de mês, igual à regra de entrada já existente.
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

    const pendentes = await sql`
      SELECT * FROM "TransacaoBancariaImportada"
      WHERE "contaBancariaId" = ${id} AND tipo = 'saida' AND status = 'pendente'
      ORDER BY data ASC
    `;

    // Marcador único pra reconhecer o erro de "outra execução já processou essa transação"
    // dentro do catch abaixo, sem confundir com um erro de verdade.
    const JA_PROCESSADO = "ja_processado_por_outra_execucao";

    let aplicados = 0;
    let jaProcessados = 0;
    let semRegra = 0;
    const detalhes: Array<{ data: string; valor: number; descricao: string; contato: string; categoria: string | null }> = [];

    for (const t of pendentes) {
      const descricaoLower = (t.descricao || "").toLowerCase();
      const complementarLower = (t.descricaoComplementar || "").toLowerCase();
      const [regra] = await sql`
        SELECT r.*, c.nome AS "contatoNome", cat.nome AS "categoriaNome"
        FROM "RegraConciliacaoBancaria" r
        JOIN "Contato" c ON c.id = r."contatoId"
        LEFT JOIN "CategoriaFinanceira" cat ON cat.id = r."categoriaId"
        WHERE ${descricaoLower} LIKE '%' || r."padraoDescricao" || '%'
           OR ${complementarLower} LIKE '%' || r."padraoDescricao" || '%'
        ORDER BY LENGTH(r."padraoDescricao") DESC
        LIMIT 1
      `;
      if (!regra) { semRegra++; continue; }

      try {
        await sql.begin(async (sql) => {
          const [novoLancamento] = await sql`
            INSERT INTO "LancamentoFinanceiro"
              (tipo, "contatoId", valor, "valorPago", "dataVencimento", "dataCompetencia", descricao, "contaBancariaId")
            VALUES
              ('pagar', ${regra.contatoId}, ${t.valor}, ${t.valor}, ${t.data}, ${t.data}, ${regra.descricao || t.descricao}, ${id})
            RETURNING *
          `;
          if (regra.categoriaId) {
            await sql`
              INSERT INTO "LancamentoFinanceiroCategoria" ("lancamentoId", "categoriaId", valor)
              VALUES (${novoLancamento.id}, ${regra.categoriaId}, ${t.valor})
            `;
          }
          if (regra.centroCustoId) {
            await sql`
              INSERT INTO "LancamentoFinanceiroCentroCusto" ("lancamentoId", "centroCustoId", valor)
              VALUES (${novoLancamento.id}, ${regra.centroCustoId}, ${t.valor})
            `;
          }
          await sql`
            INSERT INTO "Baixa" ("lancamentoId", valor, data, "contaBancariaId", observacao)
            VALUES (${novoLancamento.id}, ${t.valor}, ${t.data}, ${id}, ${"Conciliado retroativamente via regra aprendida"})
          `;
          // Só confirma se a transação ainda estiver 'pendente' nesse exato instante — mesma
          // proteção contra corrida da regra de entrada, evita duplicar lançamento órfão.
          const [reservada] = await sql`
            UPDATE "TransacaoBancariaImportada" SET status = 'conciliado', "lancamentoId" = ${novoLancamento.id}
            WHERE id = ${t.id} AND status = 'pendente'
            RETURNING id
          `;
          if (!reservada) throw new Error(JA_PROCESSADO);
        });
        aplicados++;
        detalhes.push({
          data: t.data,
          valor: t.valor,
          descricao: regra.descricao || t.descricao,
          contato: regra.contatoNome,
          categoria: regra.categoriaNome ?? null,
        });
      } catch (err) {
        if (err instanceof Error && err.message === JA_PROCESSADO) {
          jaProcessados++;
          continue;
        }
        throw err;
      }
    }

    return NextResponse.json({ ok: true, aplicados, jaProcessados, semRegra, totalPendentesAntes: pendentes.length, detalhes });
  } catch (error: any) {
    console.error("[POST /api/financeiro/contas-bancarias/[id]/aplicar-regras-saida]", error);
    return NextResponse.json({ error: error?.message || "Erro ao aplicar regras de saída" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
