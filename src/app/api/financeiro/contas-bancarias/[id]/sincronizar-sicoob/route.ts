import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";
import { SicoobClient } from "@/lib/bank/sicoob-client";

export const dynamic = "force-dynamic";

// Tolerância de diferença de valor pra considerar "o mesmo pagamento" ao casar
// automaticamente uma transação do extrato com uma conta a pagar/receber em aberto.
const TOLERANCIA_VALOR = 0.01;

// POST /api/financeiro/contas-bancarias/[id]/sincronizar-sicoob
// Puxa saldo + extrato reais do Sicoob, salva as transações e tenta conciliar
// automaticamente com as contas a pagar/receber já cadastradas.
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
    if (!conta.sicoobClientId || !conta.sicoobCertificado || !conta.sicoobChavePrivada || !conta.sicoobNumeroConta) {
      return NextResponse.json({ error: "Esta conta não tem credenciais Sicoob configuradas. Configure em Cadastros → Contas Bancárias." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const now = new Date();
    const mes = body.mes ?? now.getMonth() + 1;
    const ano = body.ano ?? now.getFullYear();

    const client = new SicoobClient(conta.sicoobClientId, conta.sicoobCertificado, conta.sicoobChavePrivada);

    // 1. Saldo real
    const respostaSaldo = await client.getSaldo(conta.sicoobNumeroConta);
    const saldoAtual = Number(respostaSaldo?.resultado?.saldo ?? respostaSaldo?.saldo ?? 0);
    await sql`
      UPDATE "ContaBancaria" SET "saldoSicoob" = ${saldoAtual}, "saldoSicoobAtualizadoEm" = NOW()
      WHERE id = ${id}
    `;

    // 2. Extrato
    const respostaExtrato = await client.getExtrato(conta.sicoobNumeroConta, mes, ano);
    const transacoesRaw: any[] = respostaExtrato?.resultado?.transacoes ?? [];

    let novos = 0;
    let autoConciliados = 0;
    let pendentes = 0;
    let jaImportados = 0;

    for (const t of transacoesRaw) {
      const idTransacaoSicoob: string | null = t.transactionId ?? null;
      const valor = Math.abs(Number(t.valor ?? 0));
      const tipo: "entrada" | "saida" = t.tipo === "CREDITO" ? "entrada" : "saida";
      const data = String(t.dataLote ?? t.data ?? "").slice(0, 10);
      const descricao = t.descricao ?? "Lançamento bancário";
      const descricaoComplementar = t.descInfComplementar ?? null;

      if (!data || valor <= 0) continue;

      // Reserva a transação de forma atômica antes de decidir o que fazer com ela — evita
      // duplicar em corridas (ex: duas sincronizações do mesmo período rodando ao mesmo tempo).
      // Se o INSERT não retornar linha, é porque outra execução já pegou essa transação primeiro.
      const [reservada] = idTransacaoSicoob
        ? await sql`
            INSERT INTO "TransacaoBancariaImportada"
              (id, "contaBancariaId", "idTransacaoSicoob", data, valor, tipo, descricao, "descricaoComplementar", status)
            VALUES
              (gen_random_uuid()::text, ${id}, ${idTransacaoSicoob}, ${data}, ${valor}, ${tipo}, ${descricao}, ${descricaoComplementar}, 'pendente')
            ON CONFLICT ("contaBancariaId", "idTransacaoSicoob") WHERE "idTransacaoSicoob" IS NOT NULL DO NOTHING
            RETURNING *
          `
        : await sql`
            INSERT INTO "TransacaoBancariaImportada"
              (id, "contaBancariaId", "idTransacaoSicoob", data, valor, tipo, descricao, "descricaoComplementar", status)
            VALUES
              (gen_random_uuid()::text, ${id}, ${idTransacaoSicoob}, ${data}, ${valor}, ${tipo}, ${descricao}, ${descricaoComplementar}, 'pendente')
            RETURNING *
          `;

      if (!reservada) { jaImportados++; continue; }
      novos++;

      // Tenta casar com uma conta a pagar/receber em aberto do mesmo tipo e valor equivalente,
      // priorizando a de vencimento mais próximo da data real do pagamento.
      const tipoAgendamento = tipo === "entrada" ? "receber" : "pagar";
      const [match] = await sql`
        SELECT * FROM "LancamentoFinanceiro"
        WHERE tipo = ${tipoAgendamento}
          AND (valor - "valorPago") BETWEEN ${valor - TOLERANCIA_VALOR} AND ${valor + TOLERANCIA_VALOR}
        ORDER BY ABS("dataVencimento"::date - ${data}::date) ASC
        LIMIT 1
      `;

      if (match) {
        await sql.begin(async (sql) => {
          await sql`
            INSERT INTO "Baixa" ("lancamentoId", valor, data, "contaBancariaId", observacao)
            VALUES (${match.id}, ${valor}, ${data}, ${id}, ${"Conciliado automaticamente via Sicoob"})
          `;
          await sql`
            UPDATE "LancamentoFinanceiro" SET "valorPago" = ${match.valorPago + valor}, "updatedAt" = NOW()
            WHERE id = ${match.id}
          `;
          await sql`
            UPDATE "TransacaoBancariaImportada" SET status = 'conciliado', "lancamentoId" = ${match.id} WHERE id = ${reservada.id}
          `;
        });
        autoConciliados++;
        continue;
      }

      // Sem match — se for entrada e a conta tiver regra automática configurada, cria e já baixa
      // o lançamento sozinho (ex: vendas avulsas de produto que não passam por "conta a receber").
      if (tipo === "entrada" && conta.regraEntradaAtiva && conta.regraEntradaContatoId) {
        await sql.begin(async (sql) => {
          const [novoLancamento] = await sql`
            INSERT INTO "LancamentoFinanceiro"
              (tipo, "contatoId", valor, "valorPago", "dataVencimento", "dataCompetencia", descricao, "contaBancariaId")
            VALUES
              ('receber', ${conta.regraEntradaContatoId}, ${valor}, ${valor}, ${data}, ${data}, ${descricao}, ${id})
            RETURNING *
          `;
          if (conta.regraEntradaCategoriaId) {
            await sql`
              INSERT INTO "LancamentoFinanceiroCategoria" ("lancamentoId", "categoriaId", valor)
              VALUES (${novoLancamento.id}, ${conta.regraEntradaCategoriaId}, ${valor})
            `;
          }
          if (conta.regraEntradaCentroCustoId) {
            await sql`
              INSERT INTO "LancamentoFinanceiroCentroCusto" ("lancamentoId", "centroCustoId", valor)
              VALUES (${novoLancamento.id}, ${conta.regraEntradaCentroCustoId}, ${valor})
            `;
          }
          await sql`
            INSERT INTO "Baixa" ("lancamentoId", valor, data, "contaBancariaId", observacao)
            VALUES (${novoLancamento.id}, ${valor}, ${data}, ${id}, ${"Criado e conciliado automaticamente via regra de entrada Sicoob"})
          `;
          await sql`
            UPDATE "TransacaoBancariaImportada" SET status = 'conciliado', "lancamentoId" = ${novoLancamento.id} WHERE id = ${reservada.id}
          `;
        });
        autoConciliados++;
        continue;
      }

      // Sem match e sem regra — fica pendente pra revisão manual na Conciliação Bancária
      // (a linha já foi inserida como 'pendente' na reserva acima, não precisa fazer mais nada)
      pendentes++;
    }

    return NextResponse.json({
      ok: true,
      saldoSicoob: saldoAtual,
      mes, ano,
      totalNoExtrato: transacoesRaw.length,
      novos, autoConciliados, pendentes, jaImportados,
    });
  } catch (error: any) {
    console.error("[POST /api/financeiro/contas-bancarias/[id]/sincronizar-sicoob]", error);
    return NextResponse.json({ error: error?.message || "Erro ao sincronizar com o Sicoob" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
