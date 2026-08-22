import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";

export const dynamic = "force-dynamic";

// POST /api/financeiro/transacoes-bancarias/[id]/conciliar
// Conciliação manual de uma transação importada do banco. Aceita um dos três formatos:
//   { lancamentoId }               -> baixa uma conta a pagar/receber já existente
//   { novoLancamento: {...} }      -> cria uma conta já paga e baixa na hora
//   { ignorar: true }              -> marca como ignorada (ex: transferência interna já tratada)
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Variável DATABASE_URL não configurada." }, { status: 500 });
  }
  const { id } = await ctx.params;
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const b = await request.json();

    const [transacao] = await sql`SELECT * FROM "TransacaoBancariaImportada" WHERE id = ${id}`;
    if (!transacao) return NextResponse.json({ error: "Transação não encontrada" }, { status: 404 });
    if (transacao.status !== "pendente") {
      return NextResponse.json({ error: "Esta transação já foi conciliada ou ignorada" }, { status: 400 });
    }

    if (b.ignorar) {
      const [atualizado] = await sql`
        UPDATE "TransacaoBancariaImportada" SET status = 'ignorado' WHERE id = ${id} RETURNING *
      `;
      return NextResponse.json(atualizado);
    }

    if (b.lancamentoId) {
      const resultado = await sql.begin(async (sql) => {
        const [lancamento] = await sql`SELECT * FROM "LancamentoFinanceiro" WHERE id = ${b.lancamentoId}`;
        if (!lancamento) throw new Error("Conta a pagar/receber não encontrada");

        const novoValorPago = lancamento.valorPago + transacao.valor;
        if (novoValorPago > lancamento.valor + 0.01) {
          throw new Error(`Valor da transação (${transacao.valor}) excede o saldo em aberto (${(lancamento.valor - lancamento.valorPago).toFixed(2)})`);
        }

        await sql`
          INSERT INTO "Baixa" ("lancamentoId", valor, data, "contaBancariaId", observacao)
          VALUES (${b.lancamentoId}, ${transacao.valor}, ${transacao.data}, ${transacao.contaBancariaId}, ${"Conciliado manualmente via Sicoob"})
        `;
        await sql`
          UPDATE "LancamentoFinanceiro" SET "valorPago" = ${novoValorPago}, "updatedAt" = NOW() WHERE id = ${b.lancamentoId}
        `;
        const [transacaoAtualizada] = await sql`
          UPDATE "TransacaoBancariaImportada" SET status = 'conciliado', "lancamentoId" = ${b.lancamentoId} WHERE id = ${id} RETURNING *
        `;
        return transacaoAtualizada;
      });
      return NextResponse.json(resultado);
    }

    if (b.novoLancamento) {
      const { contatoId, categoriaId, centroCustoId, descricao } = b.novoLancamento;
      if (!contatoId) return NextResponse.json({ error: "contatoId é obrigatório pra criar um novo lançamento" }, { status: 400 });

      const tipoLancamento = transacao.tipo === "entrada" ? "receber" : "pagar";
      const resultado = await sql.begin(async (sql) => {
        const [novoLanc] = await sql`
          INSERT INTO "LancamentoFinanceiro"
            (tipo, "contatoId", valor, "valorPago", "dataVencimento", "dataCompetencia", descricao, "contaBancariaId")
          VALUES
            (${tipoLancamento}, ${contatoId}, ${transacao.valor}, ${transacao.valor}, ${transacao.data}, ${transacao.data}, ${descricao || transacao.descricao || "Lançamento bancário"}, ${transacao.contaBancariaId})
          RETURNING *
        `;
        if (categoriaId) {
          await sql`
            INSERT INTO "LancamentoFinanceiroCategoria" ("lancamentoId", "categoriaId", valor)
            VALUES (${novoLanc.id}, ${categoriaId}, ${transacao.valor})
          `;
        }
        if (centroCustoId) {
          await sql`
            INSERT INTO "LancamentoFinanceiroCentroCusto" ("lancamentoId", "centroCustoId", valor)
            VALUES (${novoLanc.id}, ${centroCustoId}, ${transacao.valor})
          `;
        }
        await sql`
          INSERT INTO "Baixa" ("lancamentoId", valor, data, "contaBancariaId", observacao)
          VALUES (${novoLanc.id}, ${transacao.valor}, ${transacao.data}, ${transacao.contaBancariaId}, ${"Criado e conciliado manualmente via Sicoob"})
        `;
        const [transacaoAtualizada] = await sql`
          UPDATE "TransacaoBancariaImportada" SET status = 'conciliado', "lancamentoId" = ${novoLanc.id} WHERE id = ${id} RETURNING *
        `;
        return transacaoAtualizada;
      });
      return NextResponse.json(resultado);
    }

    return NextResponse.json({ error: "Envie lancamentoId, novoLancamento ou ignorar" }, { status: 400 });
  } catch (error: any) {
    console.error("[POST /api/financeiro/transacoes-bancarias/[id]/conciliar]", error);
    return NextResponse.json({ error: error?.message || "Erro ao conciliar transação" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
