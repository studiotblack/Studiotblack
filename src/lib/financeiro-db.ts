import postgres from "postgres";

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Variável DATABASE_URL não configurada no servidor.");
  }
  const isPooler = url.includes("pooler.supabase.com") || url.includes(":6543") || url.includes("pgbouncer=true");
  return postgres(url, { ssl: "require", prepare: !isPooler, onnotice: () => {} });
}

export type Sql = ReturnType<typeof getDb>;

// Todas as tabelas do módulo Financeiro Essencial ficam num único lugar — as rotas
// de API compartilham essa função em vez de repetir o CREATE TABLE em cada arquivo,
// já que várias tabelas se referenciam entre si (agendamentos -> contatos/contas/categorias).
let tablesEnsured = false;

export async function ensureFinanceiroTables(sql: Sql) {
  if (tablesEnsured) return;

  await sql`
    CREATE TABLE IF NOT EXISTS "ContaBancaria" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      nome TEXT NOT NULL,
      banco TEXT NOT NULL,
      "tipoConta" TEXT NOT NULL DEFAULT 'Conta corrente',
      agencia TEXT,
      conta TEXT,
      "saldoInicial" FLOAT NOT NULL DEFAULT 0,
      "dataSaldoInicial" TEXT NOT NULL,
      ativa BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "Contato" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      nome TEXT NOT NULL,
      "cpfCnpj" TEXT,
      tipos TEXT[] NOT NULL DEFAULT '{}',
      email TEXT,
      telefone TEXT,
      observacoes TEXT,
      ativo BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "CategoriaFinanceira" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      codigo TEXT,
      grupo TEXT NOT NULL,
      "categoriaPai" TEXT,
      nome TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'saida',
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "CentroCusto" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      nome TEXT NOT NULL,
      ativo BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;

  // Credenciais Sicoob (mTLS) e regra de classificação automática de entrada — por conta,
  // porque a regra é vinculada à conta bancária de origem (Studio T'Black x Maria Justa),
  // não ao fato de ser entrada. "regraEntradaAtiva" começa desligada: só passa a classificar
  // sozinho quando o usuário ligar a configuração pra aquela conta.
  await sql`ALTER TABLE "ContaBancaria" ADD COLUMN IF NOT EXISTS "sicoobClientId" TEXT`;
  await sql`ALTER TABLE "ContaBancaria" ADD COLUMN IF NOT EXISTS "sicoobCertificado" TEXT`;
  await sql`ALTER TABLE "ContaBancaria" ADD COLUMN IF NOT EXISTS "sicoobChavePrivada" TEXT`;
  await sql`ALTER TABLE "ContaBancaria" ADD COLUMN IF NOT EXISTS "sicoobNumeroConta" TEXT`;
  await sql`ALTER TABLE "ContaBancaria" ADD COLUMN IF NOT EXISTS "regraEntradaAtiva" BOOLEAN NOT NULL DEFAULT false`;
  await sql`ALTER TABLE "ContaBancaria" ADD COLUMN IF NOT EXISTS "regraEntradaContatoId" TEXT REFERENCES "Contato"(id)`;
  await sql`ALTER TABLE "ContaBancaria" ADD COLUMN IF NOT EXISTS "regraEntradaCategoriaId" TEXT REFERENCES "CategoriaFinanceira"(id)`;
  await sql`ALTER TABLE "ContaBancaria" ADD COLUMN IF NOT EXISTS "regraEntradaCentroCustoId" TEXT REFERENCES "CentroCusto"(id)`;

  // Cache do saldo real puxado do Sicoob na última sincronização — usado no Fluxo de Caixa
  // pra mostrar o saldo de verdade da conta em vez do calculado localmente, quando disponível.
  await sql`ALTER TABLE "ContaBancaria" ADD COLUMN IF NOT EXISTS "saldoSicoob" FLOAT`;
  await sql`ALTER TABLE "ContaBancaria" ADD COLUMN IF NOT EXISTS "saldoSicoobAtualizadoEm" TIMESTAMP`;

  // Regra de classificação automática de SAÍDA sem categoria vinda do dicionário de
  // palavras-chave (ex: comprovante do WhatsApp sem nenhuma palavra reconhecida) — mesmo
  // espírito da regra de entrada, mas o contato aqui é só um "fornecedor genérico" padrão.
  await sql`ALTER TABLE "ContaBancaria" ADD COLUMN IF NOT EXISTS "regraSaidaAtiva" BOOLEAN NOT NULL DEFAULT false`;
  await sql`ALTER TABLE "ContaBancaria" ADD COLUMN IF NOT EXISTS "regraSaidaContatoId" TEXT REFERENCES "Contato"(id)`;
  await sql`ALTER TABLE "ContaBancaria" ADD COLUMN IF NOT EXISTS "regraSaidaCategoriaId" TEXT REFERENCES "CategoriaFinanceira"(id)`;
  await sql`ALTER TABLE "ContaBancaria" ADD COLUMN IF NOT EXISTS "regraSaidaCentroCustoId" TEXT REFERENCES "CentroCusto"(id)`;

  // Chamado "LancamentoFinanceiro" (não "Agendamento") porque esse nome já existe no schema
  // pra outra coisa — o agendamento de horário de atendimento do salão (model Agendamento
  // em prisma/schema.prisma: cliente/colaborador/data/hora). São entidades completamente
  // diferentes; nomear igual causaria colisão de tabela no Postgres.
  await sql`
    CREATE TABLE IF NOT EXISTS "LancamentoFinanceiro" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      tipo TEXT NOT NULL,
      "contatoId" TEXT NOT NULL REFERENCES "Contato"(id),
      valor FLOAT NOT NULL,
      "valorPago" FLOAT NOT NULL DEFAULT 0,
      "dataVencimento" TEXT NOT NULL,
      "dataCompetencia" TEXT NOT NULL,
      "dataPrevisao" TEXT,
      descricao TEXT NOT NULL,
      referencia TEXT,
      detalhamento TEXT,
      "contaBancariaId" TEXT REFERENCES "ContaBancaria"(id),
      reembolsavel BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;

  // Rateio N:N — v1 da tela só cria 1 linha por lançamento, mas o schema já suporta várias
  await sql`
    CREATE TABLE IF NOT EXISTS "LancamentoFinanceiroCategoria" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "lancamentoId" TEXT NOT NULL REFERENCES "LancamentoFinanceiro"(id) ON DELETE CASCADE,
      "categoriaId" TEXT NOT NULL REFERENCES "CategoriaFinanceira"(id),
      valor FLOAT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "LancamentoFinanceiroCentroCusto" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "lancamentoId" TEXT NOT NULL REFERENCES "LancamentoFinanceiro"(id) ON DELETE CASCADE,
      "centroCustoId" TEXT NOT NULL REFERENCES "CentroCusto"(id),
      valor FLOAT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "Baixa" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "lancamentoId" TEXT NOT NULL REFERENCES "LancamentoFinanceiro"(id) ON DELETE CASCADE,
      valor FLOAT NOT NULL,
      data TEXT NOT NULL,
      "contaBancariaId" TEXT NOT NULL REFERENCES "ContaBancaria"(id),
      observacao TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;

  // Cache do extrato puxado do Sicoob — uma linha por transação bancária real, independente
  // de já ter sido conciliada ou não. "idTransacaoSicoob" é o identificador que o próprio banco
  // manda, usado pra não reimportar a mesma transação numa sincronização seguinte.
  await sql`
    CREATE TABLE IF NOT EXISTS "TransacaoBancariaImportada" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "contaBancariaId" TEXT NOT NULL REFERENCES "ContaBancaria"(id),
      "idTransacaoSicoob" TEXT,
      data TEXT NOT NULL,
      hora TEXT,
      valor FLOAT NOT NULL,
      tipo TEXT NOT NULL,
      descricao TEXT,
      "descricaoComplementar" TEXT,
      status TEXT NOT NULL DEFAULT 'pendente',
      "lancamentoId" TEXT REFERENCES "LancamentoFinanceiro"(id),
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  // Evita reimportar a mesma transação do banco quando o usuário sincroniza de novo o mesmo período
  // (parcial: idTransacaoSicoob nulo não conflita, só bloqueia duplicata de um id real repetido).
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_transacao_sicoob_unica
    ON "TransacaoBancariaImportada" ("contaBancariaId", "idTransacaoSicoob")
    WHERE "idTransacaoSicoob" IS NOT NULL
  `;

  // Comprovantes capturados do grupo do WhatsApp (imagem + legenda). "mensagemWhatsappId" evita
  // processar a mesma mensagem duas vezes entre sincronizações.
  await sql`
    CREATE TABLE IF NOT EXISTS "WhatsappComprovante" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "mensagemWhatsappId" TEXT UNIQUE,
      "grupoId" TEXT,
      remetente TEXT,
      "dataHoraEnvio" TIMESTAMP,
      "imagemPath" TEXT,
      "textoLegenda" TEXT,
      "valorOcr" FLOAT,
      "dataHoraOcr" TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'pendente',
      "transacaoBancariaId" TEXT REFERENCES "TransacaoBancariaImportada"(id),
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  // Categoria sugerida pelo dicionário de palavras-chave pra esse comprovante — preenchida
  // mesmo quando não dá pra fazer o match automático com uma transação bancária, pra já
  // vir pré-selecionada na hora da conciliação manual.
  await sql`ALTER TABLE "WhatsappComprovante" ADD COLUMN IF NOT EXISTS "categoriaSugeridaId" TEXT REFERENCES "CategoriaFinanceira"(id)`;

  // Dicionário de palavras-chave pra categoria de saída — usado no match automático e
  // realimentado sempre que o usuário resolve manualmente um caso que o dicionário não cobria.
  await sql`
    CREATE TABLE IF NOT EXISTS "CategoriaPalavraChave" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "palavraChave" TEXT NOT NULL UNIQUE,
      "categoriaId" TEXT NOT NULL REFERENCES "CategoriaFinanceira"(id),
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;

  // Meta de faturamento mensal do negócio (linha única, id fixo "default") — usada no card
  // "Receita do Mês (real x meta)" do Fluxo de Caixa. Não confundir com as metas de
  // serviço/produto por profissional (essas ficam em ConfigMetas, no módulo Performance).
  await sql`
    CREATE TABLE IF NOT EXISTS "MetaFinanceira" (
      id TEXT PRIMARY KEY DEFAULT 'default',
      "metaReceitaMensal" FLOAT NOT NULL DEFAULT 0,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  // JID do grupo do WhatsApp de onde vêm os comprovantes de saída pra conciliação automática
  await sql`ALTER TABLE "MetaFinanceira" ADD COLUMN IF NOT EXISTS "whatsappGrupoJid" TEXT`;

  await sql`
    CREATE TABLE IF NOT EXISTS "Transferencia" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "contaOrigemId" TEXT NOT NULL REFERENCES "ContaBancaria"(id),
      "contaDestinoId" TEXT NOT NULL REFERENCES "ContaBancaria"(id),
      valor FLOAT NOT NULL,
      data TEXT NOT NULL,
      descricao TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;

  // Contas fixas/recorrentes sem uma data de vencimento definida ainda (o usuário vai
  // preenchendo aos poucos) precisam poder ficar em aberto — sem isso não dava pra
  // cadastrar a conta como lembrete antes de saber o dia exato de cobrança.
  await sql`ALTER TABLE "LancamentoFinanceiro" ALTER COLUMN "dataVencimento" DROP NOT NULL`;

  // Regra aprendida de conciliação bancária: na primeira vez que o usuário concilia
  // manualmente uma transação e marca "lembrar esse padrão", grava aqui um trecho da
  // descrição do banco (ex: "sabesp") -> contato/categoria/centro de custo. Da próxima
  // vez que uma transação com essa descrição aparecer, já casa sozinha sem precisar
  // repetir a conciliação manual (ex: toda conta de água da Sabesp cai na Água e Esgoto).
  await sql`
    CREATE TABLE IF NOT EXISTS "RegraConciliacaoBancaria" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "padraoDescricao" TEXT NOT NULL UNIQUE,
      "contatoId" TEXT NOT NULL REFERENCES "Contato"(id),
      "categoriaId" TEXT REFERENCES "CategoriaFinanceira"(id),
      "centroCustoId" TEXT REFERENCES "CentroCusto"(id),
      descricao TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;

  tablesEnsured = true;
}
