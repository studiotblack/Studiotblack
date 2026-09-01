import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";

export const dynamic = "force-dynamic";

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Variável DATABASE_URL não configurada no servidor.");
  }
  const isPooler = url.includes("pooler.supabase.com") || url.includes(":6543") || url.includes("pgbouncer=true");
  return postgres(url, {
    ssl: "require",
    prepare: !isPooler,
  });
}

let tableEnsured = false;

async function ensureTable(sql: ReturnType<typeof postgres>) {
  if (tableEnsured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS "MetaProfissional" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "contatoId" TEXT NOT NULL,
      "mesAno" TEXT NOT NULL,
      "metaServicos" FLOAT NOT NULL,
      "metaProdutos" FLOAT NOT NULL,
      "metaTicket" FLOAT NOT NULL,
      "bonusServicos" FLOAT NOT NULL,
      "bonusProdutos" FLOAT NOT NULL,
      "bonusTicket" FLOAT NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE("contatoId", "mesAno")
    )
  `;
  tableEnsured = true;
}

// GET /api/performance/metas?mesAno=09/2026 — todas as metas do mês (ou de um contato específico)
export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json([], { status: 200 });
  const sql = getDb();
  try {
    await ensureTable(sql);
    const { searchParams } = new URL(request.url);
    const mesAno = searchParams.get("mesAno");
    const contatoId = searchParams.get("contatoId");

    let rows;
    if (mesAno && contatoId) {
      rows = await sql`SELECT * FROM "MetaProfissional" WHERE "mesAno" = ${mesAno} AND "contatoId" = ${contatoId}`;
    } else if (mesAno) {
      rows = await sql`SELECT * FROM "MetaProfissional" WHERE "mesAno" = ${mesAno}`;
    } else if (contatoId) {
      rows = await sql`SELECT * FROM "MetaProfissional" WHERE "contatoId" = ${contatoId} ORDER BY "mesAno" DESC`;
    } else {
      rows = await sql`SELECT * FROM "MetaProfissional" ORDER BY "mesAno" DESC`;
    }

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("[GET /api/performance/metas]", error);
    return NextResponse.json({ error: error?.message || "Erro ao buscar metas" }, { status: 500 });
  } finally {
    await sql.end();
  }
}

// POST /api/performance/metas — cria ou atualiza a meta de um contato/mês (upsert)
export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Variável DATABASE_URL não configurada." }, { status: 500 });
  }
  const sql = getDb();
  try {
    await ensureTable(sql);
    const body = await request.json();
    const { contatoId, mesAno, metaServicos, metaProdutos, metaTicket, bonusServicos, bonusProdutos, bonusTicket } = body;

    if (!contatoId || !mesAno) {
      return NextResponse.json({ error: "contatoId e mesAno são obrigatórios" }, { status: 400 });
    }

    const [meta] = await sql`
      INSERT INTO "MetaProfissional"
        ("contatoId", "mesAno", "metaServicos", "metaProdutos", "metaTicket", "bonusServicos", "bonusProdutos", "bonusTicket")
      VALUES (${contatoId}, ${mesAno}, ${metaServicos ?? 0}, ${metaProdutos ?? 0}, ${metaTicket ?? 0}, ${bonusServicos ?? 0}, ${bonusProdutos ?? 0}, ${bonusTicket ?? 0})
      ON CONFLICT ("contatoId", "mesAno") DO UPDATE SET
        "metaServicos" = EXCLUDED."metaServicos",
        "metaProdutos" = EXCLUDED."metaProdutos",
        "metaTicket" = EXCLUDED."metaTicket",
        "bonusServicos" = EXCLUDED."bonusServicos",
        "bonusProdutos" = EXCLUDED."bonusProdutos",
        "bonusTicket" = EXCLUDED."bonusTicket",
        "updatedAt" = NOW()
      RETURNING *
    `;

    return NextResponse.json({ sucesso: true, meta });
  } catch (error: any) {
    console.error("[POST /api/performance/metas]", error);
    return NextResponse.json({ error: error?.message || "Erro ao salvar meta" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
