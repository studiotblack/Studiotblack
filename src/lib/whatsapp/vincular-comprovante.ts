import type { Sql } from "@/lib/financeiro-db";

// Tolerância de diferença de valor pra considerar "o mesmo pagamento" entre o que o OCR
// leu no comprovante e o que consta no extrato bancário já importado.
const TOLERANCIA_VALOR = 0.02;

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
  const [transacao] = await sql`
    SELECT * FROM "TransacaoBancariaImportada"
    WHERE tipo = 'saida' AND status = 'pendente'
      AND valor BETWEEN ${comp.valorOcr - TOLERANCIA_VALOR} AND ${comp.valorOcr + TOLERANCIA_VALOR}
    ORDER BY ABS(data::date - ${dataComp}::date) ASC
    LIMIT 1
  `;
  if (!transacao) {
    return { status: "sem_correspondencia", motivo: "nenhuma transação bancária com esse valor/data" };
  }

  // Regra aprendida de conciliação (a mesma que o Sicoob e a tela de Conciliação usam):
  // reconhece a contraparte do Pix pela descrição do banco e já traz contato/categoria/
  // centro de custo certos — prioridade sobre o dicionário de legenda e o fallback genérico.
  const descricaoLower = (transacao.descricao || "").toLowerCase();
  const complementarLower = (transacao.descricaoComplementar || "").toLowerCase();
  const [regra] = await sql`
    SELECT * FROM "RegraConciliacaoBancaria"
    WHERE ${descricaoLower} LIKE '%' || "padraoDescricao" || '%'
       OR ${complementarLower} LIKE '%' || "padraoDescricao" || '%'
    ORDER BY LENGTH("padraoDescricao") DESC
    LIMIT 1
  `;
  if (regra?.categoriaId) categoriaSugeridaId = regra.categoriaId;

  const [conta] = await sql`SELECT * FROM "ContaBancaria" WHERE id = ${transacao.contaBancariaId}`;
  const contatoId: string | null =
    regra?.contatoId ??
    (conta?.regraSaidaAtiva && conta?.regraSaidaContatoId ? conta.regraSaidaContatoId : contatoFallback?.id ?? null);
  if (!contatoId) {
    return { status: "sem_correspondencia", motivo: "sem contato pra usar" };
  }

  await sql.begin(async (sql) => {
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
  });

  const [contatoNome] = await sql`SELECT nome FROM "Contato" WHERE id = ${contatoId}`;
  const categoriaNome = categoriaSugeridaId
    ? (await sql`SELECT nome FROM "CategoriaFinanceira" WHERE id = ${categoriaSugeridaId}`)[0]?.nome ?? null
    : null;

  return { status: "vinculado", categoria: categoriaNome, contato: contatoNome?.nome ?? null, valor: transacao.valor };
}
