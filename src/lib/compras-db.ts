import { randomBytes } from "crypto";
import type { Sql } from "@/lib/financeiro-db";

// Módulo de Compras (checklist semanal da recepção). Mesmo padrão do financeiro-db:
// DDL sequencial, NUNCA em transação (ver CLAUDE.md — deadlock sob concorrência).
let tablesEnsured = false;

// Lista inicial (enviada pelo dono em 15/10/2026). Só semeia se a tabela estiver vazia.
// tipo "revenda" = produto de venda; "consumo" = uso interno (copa, limpeza...).
const SEED: { setor: string; tipo: "revenda" | "consumo"; itens: string[] }[] = [
  { setor: "WS", tipo: "revenda", itens: ["Shampoo", "Condicionador", "Gelatina", "Acidificante", "Ativador de cachos", "Óleo", "Creme de pentear"] },
  {
    setor: "Mirra", tipo: "revenda", itens: [
      "Shampoo Tutano", "Condicionador Tutano", "Máscara Tutano", "Leave-in Tutano",
      "Shampoo Cacau", "Condicionador Cacau", "Máscara Cacau", "Leave-in Cacau",
      "Shampoo Vegetal", "Condicionador Vegetal", "Máscara Vegetal", "Leave-in Vegetal",
      "Óleo Elixir", "Óleo MS Curls",
      "Shampoo MS Curls", "Condicionador MS Curls", "Leave-in MS Curls", "Mousse",
    ],
  },
  { setor: "Raise", tipo: "revenda", itens: ["Máscara de finalização", "Shampoo suave", "Geleia modeladora", "Mousse"] },
  { setor: "Burb", tipo: "revenda", itens: ["Pasta alta fixação", "Pasta média fixação", "Balm Uptown", "Balm Midtown"] },
  { setor: "Soulta", tipo: "revenda", itens: ["Escova para fitagem", "Laço cetim anti-frizz", "Xuxão cetim"] },
  { setor: "Studio", tipo: "revenda", itens: ["Touca de cetim", "Touca difusora", "Fronha de cetim", "Pente 3 fileiras"] },
  { setor: "Copa", tipo: "consumo", itens: ["Leite", "Manteiga"] },
];

export async function ensureComprasTables(sql: Sql) {
  if (tablesEnsured) return;

  await sql`
    CREATE TABLE IF NOT EXISTS "CompraItem" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      setor TEXT NOT NULL,
      nome TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'revenda',
      ordem INT NOT NULL DEFAULT 0,
      ativo BOOLEAN NOT NULL DEFAULT true,
      aprovado BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS "CompraChecklist" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "preenchidoPor" TEXT NOT NULL,
      observacao TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS "CompraPedidoItem" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "checklistId" TEXT NOT NULL REFERENCES "CompraChecklist"(id) ON DELETE CASCADE,
      "itemId" TEXT NOT NULL REFERENCES "CompraItem"(id),
      quantidade INT,
      observacao TEXT,
      status TEXT NOT NULL DEFAULT 'pendente',
      "dataCompra" TEXT,
      "quantidadeComprada" INT,
      valor FLOAT,
      "lancamentoId" TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS "CompraPedidoItem_item_idx" ON "CompraPedidoItem" ("itemId")`;
  await sql`
    CREATE TABLE IF NOT EXISTS "CompraConfig" (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  // Mesma regra do alerta de segurança de 03/10 (RLS): tabelas novas já nascem fechadas
  // pra API pública do Supabase — o sistema acessa pelo usuário postgres, que ignora RLS.
  for (const t of ["CompraItem", "CompraChecklist", "CompraPedidoItem", "CompraConfig"]) {
    await sql.unsafe(`ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY`);
  }

  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM "CompraItem"`;
  if (n === 0) {
    let ordem = 0;
    for (const grupo of SEED) {
      for (const nome of grupo.itens) {
        await sql`INSERT INTO "CompraItem" (setor, nome, tipo, ordem) VALUES (${grupo.setor}, ${nome}, ${grupo.tipo}, ${ordem++})`;
      }
    }
  }

  const [cfg] = await sql`SELECT id FROM "CompraConfig" WHERE id = 'default'`;
  if (!cfg) {
    await sql`INSERT INTO "CompraConfig" (id, token) VALUES ('default', ${gerarToken()}) ON CONFLICT (id) DO NOTHING`;
  }

  tablesEnsured = true;
}

export function gerarToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function tokenValido(sql: Sql, token: string): Promise<boolean> {
  if (!token || token.length < 16) return false;
  const [cfg] = await sql`SELECT token FROM "CompraConfig" WHERE id = 'default'`;
  return !!cfg && cfg.token === token;
}

// Estatísticas por item usadas na lista pública e na tela de cadastro:
//  • ultimoPedido  — data/quantidade do pedido mais recente (qualquer status)
//  • pedidos90d    — quantas vezes foi pedido nos últimos 90 dias (giro)
//  • aberto        — existe pedido pendente ainda não comprado (evita pedir de novo)
export async function carregarItensComEstatisticas(sql: Sql, opts: { incluirInativos?: boolean; incluirNaoAprovados?: boolean } = {}) {
  return sql`
    SELECT i.id, i.setor, i.nome, i.tipo, i.ordem, i.ativo, i.aprovado,
      (SELECT to_char(p."createdAt" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD')
         FROM "CompraPedidoItem" p WHERE p."itemId" = i.id ORDER BY p."createdAt" DESC LIMIT 1) AS "ultimoPedidoData",
      (SELECT p.quantidade FROM "CompraPedidoItem" p WHERE p."itemId" = i.id ORDER BY p."createdAt" DESC LIMIT 1) AS "ultimoPedidoQtd",
      (SELECT COUNT(*)::int FROM "CompraPedidoItem" p WHERE p."itemId" = i.id AND p."createdAt" > NOW() - INTERVAL '90 days') AS "pedidos90d",
      (SELECT to_char(p."createdAt" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD')
         FROM "CompraPedidoItem" p WHERE p."itemId" = i.id AND p.status = 'pendente' ORDER BY p."createdAt" ASC LIMIT 1) AS "abertoDesde"
    FROM "CompraItem" i
    WHERE (${opts.incluirInativos ?? false} OR i.ativo = true)
      AND (${opts.incluirNaoAprovados ?? false} OR i.aprovado = true)
    ORDER BY i.ordem ASC, i.nome ASC
  `;
}
