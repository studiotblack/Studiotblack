import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";
import { proximaData } from "@/lib/financeiro-recorrencia";

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
      // FOR UPDATE trava a linha do agendamento assim que lida — sem isso, duas baixas
      // concorrentes no mesmo agendamento (ex: duplo clique no BaixaModal, ou uma baixa manual
      // coincidindo com o sync automático do banco achando o mesmo match) liam o mesmo
      // valorPago desatualizado. Além de sub-contar o valor pago, isso podia gerar a PRÓXIMA
      // ocorrência de uma conta recorrente DUAS VEZES (as duas leituras concorrentes viam
      // "ainda não quitou" com base no valor antigo) — mesma classe de bug confirmada em
      // vincular-comprovante.ts (comprovante "Água superior").
      const [agendamento] = await sql`SELECT * FROM "LancamentoFinanceiro" WHERE id = ${id} FOR UPDATE`;
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

      // Ocorrência de uma série nova (LancamentoSerie) totalmente quitada — mantém uma
      // janela de 3 ocorrências futuras em aberto pra recorrência indefinida (parcelaTotal
      // nulo): gera mais uma lá na ponta. Parcelamento fechado (parcelaTotal definido) já
      // teve todas as N parcelas criadas de uma vez na hora da série — esse bloco não faz
      // nada nesse caso (o guard de parcelaTotal abaixo cobre isso sozinho).
      if (agendamento.serieId && novoValorPago >= agendamento.valor - 0.01) {
        const [serie] = await sql`SELECT * FROM "LancamentoSerie" WHERE id = ${agendamento.serieId}`;
        if (serie?.ativa) {
          const [ultimaOcorrencia] = await sql`
            SELECT * FROM "LancamentoFinanceiro" WHERE "serieId" = ${serie.id} ORDER BY "parcelaNumero" DESC LIMIT 1
          `;
          const proximoNumero = (ultimaOcorrencia?.parcelaNumero ?? agendamento.parcelaNumero ?? 0) + 1;
          if (!serie.parcelaTotal || proximoNumero <= serie.parcelaTotal) {
            const base = ultimaOcorrencia ?? agendamento;
            const [novaOcorrenciaSerie] = await sql`
              INSERT INTO "LancamentoFinanceiro"
                (tipo, "contatoId", valor, "dataVencimento", "dataCompetencia", descricao, "contaBancariaId", "serieId", "parcelaNumero")
              VALUES (
                ${serie.tipo}, ${serie.contatoId}, ${serie.valorParcela},
                ${base.dataVencimento ? proximaData(base.dataVencimento, serie.intervalo) : null},
                ${proximaData(base.dataCompetencia, serie.intervalo)},
                ${serie.descricao}, ${serie.contaBancariaId}, ${serie.id}, ${proximoNumero}
              )
              RETURNING *
            `;
            if (serie.categoriaId) {
              await sql`INSERT INTO "LancamentoFinanceiroCategoria" ("lancamentoId", "categoriaId", valor) VALUES (${novaOcorrenciaSerie.id}, ${serie.categoriaId}, ${serie.valorParcela})`;
            }
            if (serie.centroCustoId) {
              await sql`INSERT INTO "LancamentoFinanceiroCentroCusto" ("lancamentoId", "centroCustoId", valor) VALUES (${novaOcorrenciaSerie.id}, ${serie.centroCustoId}, ${serie.valorParcela})`;
            }
            proximaOcorrencia = novaOcorrenciaSerie;
          }
        }
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
