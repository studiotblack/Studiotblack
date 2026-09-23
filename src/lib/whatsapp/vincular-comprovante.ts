import type { Sql } from "@/lib/financeiro-db";
import { DESCRICOES_GENERICAS_BANCO } from "@/lib/regra-conciliacao";

// Tolerância de diferença de valor pra considerar "o mesmo pagamento" entre o que o OCR
// leu no comprovante e o que consta no extrato bancário já importado.
const TOLERANCIA_VALOR = 0.02;
// Sem isso, o match pegava a transação de valor mais próximo em QUALQUER data — como esse
// vínculo é automático (cria e já dá baixa no lançamento sozinho, sem confirmação manual),
// bastava um valor coincidente pra grudar num comprovante de hoje numa transação de meses
// atrás. Um comprovante do WhatsApp e a transação bancária correspondente sempre ficam
// perto um do outro no tempo (o banco processa em no máximo alguns dias), então 15 dias já
// é folga generosa pra atraso de compensação.
const TOLERANCIA_DIAS = 15;

export type ResultadoVinculo =
  | { status: "vinculado"; categoria: string | null; contato: string | null; valor: number }
  | { status: "sem_correspondencia"; motivo: string };

// Tenta casar um comprovante (com valorOcr já preenchido) contra uma transação de SAÍDA
// ainda pendente na Conciliação Bancária (por valor + data), decide a categoria pelo
// dicionário de palavras-chave e pela regra de conciliação aprendida, e cria+baixa o
// lançamento quando acha os dois. Compartilhado entre o loop automático da sincronização
// e a tentativa manual imediata depois de editar o valor de um comprovante sem match.
export async function tentarVincularComprovante(sql: Sql, comp: any): Promise<ResultadoVinculo> {
  const dicionario = await sql`SELECT * FROM "CategoriaPalavraChave"`;
  const [contatoFallback] = await sql`SELECT id FROM "Contato" WHERE nome = 'Fornecedor Diversos (WhatsApp)' LIMIT 1`;

  const legendaLower = (comp.textoLegenda || "").toLowerCase();
  let categoriaSugeridaId: string | null = null;
  for (const entrada of dicionario) {
    if (legendaLower.includes(String(entrada.palavraChave).toLowerCase())) {
      categoriaSugeridaId = entrada.categoriaId;
      break;
    }
  }
  await sql`UPDATE "WhatsappComprovante" SET "categoriaSugeridaId" = ${categoriaSugeridaId} WHERE id = ${comp.id}`;

  if (comp.valorOcr === null || comp.valorOcr === undefined) {
    return { status: "sem_correspondencia", motivo: "valor não reconhecido" };
  }

  const dataComp = new Date(comp.dataHoraEnvio).toISOString().slice(0, 10);

  // TUDO que decide E reserva a transação bancária (select do candidato + todas as escritas)
  // precisa estar na MESMA transação com lock de linha (FOR UPDATE). Antes, a busca da
  // transação rodava FORA de qualquer transação/lock — duas sincronizações concorrentes
  // (ex: um clique manual coincidindo com o cron, ou duas chamadas em sequência rápida
  // demais pra uma terminar antes da outra começar) podiam SELECIONAR a mesma transação
  // "pendente" antes de qualquer uma COMMITAR, e as duas tentavam vincular o mesmo dinheiro
  // — confirmado de verdade: aconteceu com um comprovante ("Água superior") ficando com o
  // vínculo real feito só que o status voltando pra "pendente", pisado pela outra tentativa
  // concorrente. FOR UPDATE trava a linha assim que selecionada: a segunda transação
  // concorrente espera a primeira terminar e aí não encontra mais nada 'pendente' pra pegar
  // (ou vê a linha genérica-por-regra já não bater mais o filtro), em vez de pegar a mesma
  // transação duas vezes.
  let resultado: ResultadoVinculo | null = null;

  await sql.begin(async (sql) => {
    let [transacao] = await sql`
      SELECT * FROM "TransacaoBancariaImportada"
      WHERE tipo = 'saida' AND status = 'pendente'
        AND valor BETWEEN ${comp.valorOcr - TOLERANCIA_VALOR} AND ${comp.valorOcr + TOLERANCIA_VALOR}
        AND ABS(data::date - ${dataComp}::date) <= ${TOLERANCIA_DIAS}
      ORDER BY ABS(data::date - ${dataComp}::date) ASC
      LIMIT 1
      FOR UPDATE
    `;

    // Sem transação pendente — mas pode já ter sido "roubada" por uma regra aprendida
    // automática (fornecedor recorrente, ex: um Marketplace) antes do comprovante ter a
    // chance. Acontece porque o OCR só resolve o valor DEPOIS (às vezes bem depois — o
    // usuário corrige na mão dias mais tarde), então no momento em que o extrato do Sicoob
    // chegou, o comprovante ainda não tinha valor nenhum pra proteger a transação. Se achar
    // uma transação já conciliada SÓ por regra automática (nunca uma conciliação manual real)
    // com o mesmo valor/data, desfaz esse vínculo genérico e usa a transação aqui — o
    // comprovante traz o item específico da compra, sempre mais correto que o nome do
    // fornecedor aprendido.
    let lancamentoRegraParaDesfazer: string | null = null;
    if (!transacao) {
      const [candidata] = await sql`
        SELECT t.* FROM "TransacaoBancariaImportada" t
        JOIN "Baixa" b ON b."lancamentoId" = t."lancamentoId"
        WHERE t.tipo = 'saida' AND t.status = 'conciliado'
          AND t.valor BETWEEN ${comp.valorOcr - TOLERANCIA_VALOR} AND ${comp.valorOcr + TOLERANCIA_VALOR}
          AND ABS(t.data::date - ${dataComp}::date) <= ${TOLERANCIA_DIAS}
          AND b.observacao ILIKE '%regra%aprendida%'
        ORDER BY ABS(t.data::date - ${dataComp}::date) ASC
        LIMIT 1
        FOR UPDATE OF t
      `;
      if (candidata) {
        lancamentoRegraParaDesfazer = candidata.lancamentoId;
        transacao = candidata;
      }
    }
    if (!transacao) {
      resultado = { status: "sem_correspondencia", motivo: "nenhuma transação bancária com esse valor/data" };
      return;
    }

    // Regra aprendida de conciliação (a mesma que o Sicoob e a tela de Conciliação usam):
    // reconhece a contraparte do Pix pela descrição do banco e já traz contato/categoria/
    // centro de custo certos — prioridade sobre o dicionário de legenda e o fallback genérico.
    const descricaoLower = (transacao.descricao || "").toLowerCase();
    const complementarLower = (transacao.descricaoComplementar || "").toLowerCase();
    const [regra] = await sql`
      SELECT * FROM "RegraConciliacaoBancaria"
      WHERE (${descricaoLower} LIKE '%' || "padraoDescricao" || '%'
         OR ${complementarLower} LIKE '%' || "padraoDescricao" || '%')
         AND "padraoDescricao" <> ALL(${DESCRICOES_GENERICAS_BANCO})
      ORDER BY LENGTH("padraoDescricao") DESC
      LIMIT 1
    `;
    if (regra?.categoriaId) categoriaSugeridaId = regra.categoriaId;

    const [conta] = await sql`SELECT * FROM "ContaBancaria" WHERE id = ${transacao.contaBancariaId}`;
    const contatoId: string | null =
      regra?.contatoId ??
      (conta?.regraSaidaAtiva && conta?.regraSaidaContatoId ? conta.regraSaidaContatoId : contatoFallback?.id ?? null);
    if (!contatoId) {
      resultado = { status: "sem_correspondencia", motivo: "sem contato pra usar" };
      return;
    }

    // Se essa transação estava presa num lançamento genérico criado só por regra
    // automática, desmancha esse vínculo primeiro (limpa os dependentes antes, já que o
    // lançamento antigo só pode ser removido depois que a transação apontar pro novo).
    if (lancamentoRegraParaDesfazer) {
      await sql`DELETE FROM "Baixa" WHERE "lancamentoId" = ${lancamentoRegraParaDesfazer}`;
      await sql`DELETE FROM "LancamentoFinanceiroCategoria" WHERE "lancamentoId" = ${lancamentoRegraParaDesfazer}`;
      await sql`DELETE FROM "LancamentoFinanceiroCentroCusto" WHERE "lancamentoId" = ${lancamentoRegraParaDesfazer}`;
    }

    const [novoLancamento] = await sql`
      INSERT INTO "LancamentoFinanceiro"
        (tipo, "contatoId", valor, "valorPago", "dataVencimento", "dataCompetencia", descricao, "contaBancariaId")
      VALUES
        ('pagar', ${contatoId}, ${transacao.valor}, ${transacao.valor}, ${transacao.data}, ${transacao.data}, ${regra?.descricao || comp.textoLegenda || transacao.descricao}, ${transacao.contaBancariaId})
      RETURNING *
    `;
    if (categoriaSugeridaId) {
      await sql`
        INSERT INTO "LancamentoFinanceiroCategoria" ("lancamentoId", "categoriaId", valor)
        VALUES (${novoLancamento.id}, ${categoriaSugeridaId}, ${transacao.valor})
      `;
    }
    const centroCustoId = regra?.centroCustoId ?? conta?.regraSaidaCentroCustoId;
    if (centroCustoId) {
      await sql`
        INSERT INTO "LancamentoFinanceiroCentroCusto" ("lancamentoId", "centroCustoId", valor)
        VALUES (${novoLancamento.id}, ${centroCustoId}, ${transacao.valor})
      `;
    }
    await sql`
      INSERT INTO "Baixa" ("lancamentoId", valor, data, "contaBancariaId", observacao)
      VALUES (${novoLancamento.id}, ${transacao.valor}, ${transacao.data}, ${transacao.contaBancariaId}, ${"Categorizado automaticamente via comprovante do WhatsApp"})
    `;
    await sql`
      UPDATE "TransacaoBancariaImportada" SET status = 'conciliado', "lancamentoId" = ${novoLancamento.id} WHERE id = ${transacao.id}
    `;
    await sql`
      UPDATE "WhatsappComprovante" SET status = 'vinculado', "transacaoBancariaId" = ${transacao.id} WHERE id = ${comp.id}
    `;

    if (lancamentoRegraParaDesfazer) {
      await sql`DELETE FROM "LancamentoFinanceiro" WHERE id = ${lancamentoRegraParaDesfazer}`;
    }

    const [contatoNome] = await sql`SELECT nome FROM "Contato" WHERE id = ${contatoId}`;
    const categoriaNome = categoriaSugeridaId
      ? (await sql`SELECT nome FROM "CategoriaFinanceira" WHERE id = ${categoriaSugeridaId}`)[0]?.nome ?? null
      : null;
    resultado = { status: "vinculado", categoria: categoriaNome, contato: contatoNome?.nome ?? null, valor: transacao.valor };
  });

  return resultado!;
}
