import type { Sql } from "@/lib/financeiro-db";
import { proximaData } from "@/lib/financeiro-recorrencia";

// Quando uma conta recorrente (mensal/semanal) ou uma ocorrência de série fica TOTALMENTE
// quitada, gera sozinha a próxima — pra não precisar recadastrar aluguel/água/comissão etc.
// na mão. Isso vivia só dentro de agendamentos/[id]/baixas, então um pagamento que entrava pela
// Conciliação Bancária (manual) ou pelo sync automático do Sicoob quitava a conta mas NUNCA
// criava a próxima: o lembrete do mês seguinte (ex: comissões) simplesmente sumia do Contas a
// Pagar. Agora os três caminhos chamam esta mesma função.
//
// Deve rodar DENTRO da transação que travou o agendamento (FOR UPDATE) e atualizou o valorPago.
// `agendamento` é a linha como estava ANTES da baixa; `novoValorPago` é o valor já com ela.
export async function gerarProximaOcorrencia(sql: Sql, agendamento: any, novoValorPago: number) {
  if (novoValorPago < agendamento.valor - 0.01) return null; // ainda não quitou
  if (agendamento.valorPago >= agendamento.valor - 0.01) return null; // já estava quitada: não repete

  let proximaOcorrencia: any = null;

  if (agendamento.recorrencia === "semanal" || agendamento.recorrencia === "mensal") {
    const proximoVencimento = agendamento.dataVencimento ? proximaData(agendamento.dataVencimento, agendamento.recorrencia) : null;

    // Se já existe uma ocorrência em aberto idêntica (mesmo contato/descrição/vencimento),
    // não cria outra — protege contra dupla geração em qualquer corrida ou reprocessamento.
    const [jaExiste] = await sql`
      SELECT id FROM "LancamentoFinanceiro"
      WHERE tipo = ${agendamento.tipo} AND "contatoId" IS NOT DISTINCT FROM ${agendamento.contatoId}
        AND descricao IS NOT DISTINCT FROM ${agendamento.descricao}
        AND "dataVencimento" IS NOT DISTINCT FROM ${proximoVencimento}
        AND "valorPago" < valor - 0.01
      LIMIT 1
    `;
    if (!jaExiste) {
      const [novaOcorrencia] = await sql`
        INSERT INTO "LancamentoFinanceiro"
          (tipo, "contatoId", valor, "dataVencimento", "dataCompetencia", descricao, "contaBancariaId", recorrencia)
        VALUES (
          ${agendamento.tipo}, ${agendamento.contatoId}, ${agendamento.valor},
          ${proximoVencimento},
          ${proximaData(agendamento.dataCompetencia, agendamento.recorrencia)},
          ${agendamento.descricao}, ${agendamento.contaBancariaId}, ${agendamento.recorrencia}
        )
        RETURNING *
      `;
      const categoriasOriginais = await sql`SELECT "categoriaId", valor FROM "LancamentoFinanceiroCategoria" WHERE "lancamentoId" = ${agendamento.id}`;
      for (const c of categoriasOriginais) {
        await sql`INSERT INTO "LancamentoFinanceiroCategoria" ("lancamentoId", "categoriaId", valor) VALUES (${novaOcorrencia.id}, ${c.categoriaId}, ${c.valor})`;
      }
      const centrosOriginais = await sql`SELECT "centroCustoId", valor FROM "LancamentoFinanceiroCentroCusto" WHERE "lancamentoId" = ${agendamento.id}`;
      for (const c of centrosOriginais) {
        await sql`INSERT INTO "LancamentoFinanceiroCentroCusto" ("lancamentoId", "centroCustoId", valor) VALUES (${novaOcorrencia.id}, ${c.centroCustoId}, ${c.valor})`;
      }
      proximaOcorrencia = novaOcorrencia;
    }
  }

  // Ocorrência de uma série nova (LancamentoSerie) totalmente quitada — mantém uma janela de 3
  // ocorrências futuras em aberto pra recorrência indefinida (parcelaTotal nulo): gera mais uma
  // lá na ponta. Parcelamento fechado (parcelaTotal definido) já teve as N parcelas criadas de
  // uma vez na hora da série — o guard de parcelaTotal abaixo cobre isso sozinho.
  if (agendamento.serieId) {
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

  return proximaOcorrencia;
}
