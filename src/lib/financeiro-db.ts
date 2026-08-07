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

  tablesEnsured = true;
}
