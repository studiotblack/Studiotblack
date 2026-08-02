import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import { isAdminRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Variável DATABASE_URL não configurada no servidor.");
  }
  const isPooler = url.includes("pooler.supabase.com") || url.includes(":6543") || url.includes("pgbouncer=true");
  return postgres(url, { ssl: "require", prepare: !isPooler, onnotice: () => {} });
}

// A tabela já existe em produção — cria só uma vez por instância do servidor
let tableEnsured = false;

async function ensureTable(sql: ReturnType<typeof postgres>) {
  if (tableEnsured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS "DreLinha" (
      id TEXT PRIMARY KEY,
      ano INTEGER NOT NULL,
      ordem INTEGER NOT NULL,
      resultado TEXT NOT NULL,
      "totalAno" FLOAT NOT NULL,
      jan FLOAT NOT NULL DEFAULT 0,
      fev FLOAT NOT NULL DEFAULT 0,
      mar FLOAT NOT NULL DEFAULT 0,
      abr FLOAT NOT NULL DEFAULT 0,
      mai FLOAT NOT NULL DEFAULT 0,
      jun FLOAT NOT NULL DEFAULT 0,
      jul FLOAT NOT NULL DEFAULT 0,
      ago FLOAT NOT NULL DEFAULT 0,
      "set" FLOAT NOT NULL DEFAULT 0,
      out FLOAT NOT NULL DEFAULT 0,
      nov FLOAT NOT NULL DEFAULT 0,
      dez FLOAT NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(ano, ordem)
    )
  `;
  tableEnsured = true;
}

// GET /api/financeiro/dre?ano=2026
export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json([], { status: 200 });
  }
  const sql = getDb();
  try {
    await ensureTable(sql);
    const { searchParams } = new URL(request.url);
    const ano = searchParams.get("ano");

    const rows = ano
      ? await sql`SELECT * FROM "DreLinha" WHERE ano = ${Number(ano)} ORDER BY ordem ASC`
      : await sql`SELECT * FROM "DreLinha" ORDER BY ano ASC, ordem ASC`;

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("[GET /api/financeiro/dre]", error);
    return NextResponse.json({ error: error?.message || "Erro ao buscar DRE" }, { status: 500 });
  } finally {
    await sql.end();
  }
}

// POST /api/financeiro/dre — substitui o ano inteiro (o relatório "Realizado" é sempre um snapshot completo do ano)
export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Variável DATABASE_URL não configurada no Vercel." }, { status: 500 });
  }
  const sql = getDb();
  try {
    await ensureTable(sql);
    const body = await request.json();
    const { ano, linhas } = body;

    if (!ano || !Array.isArray(linhas) || linhas.length === 0) {
      return NextResponse.json({ error: "ano e linhas são obrigatórios" }, { status: 400 });
    }

    await sql`DELETE FROM "DreLinha" WHERE ano = ${ano}`;

    let inseridas = 0;
    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i];
      await sql`
        INSERT INTO "DreLinha" (id, ano, ordem, resultado, "totalAno", jan, fev, mar, abr, mai, jun, jul, ago, "set", out, nov, dez, "updatedAt")
        VALUES (${`${ano}-${i}`}, ${ano}, ${i}, ${l.resultado}, ${l.totalAno},
          ${l.jan}, ${l.fev}, ${l.mar}, ${l.abr}, ${l.mai}, ${l.jun}, ${l.jul}, ${l.ago}, ${l.set}, ${l.out}, ${l.nov}, ${l.dez}, NOW())
      `;
      inseridas++;
    }

    return NextResponse.json({ sucesso: true, ano, inseridas });
  } catch (error: any) {
    console.error("[POST /api/financeiro/dre]", error);
    return NextResponse.json({ error: error?.message || "Erro ao salvar DRE" }, { status: 500 });
  } finally {
    await sql.end();
  }
}

// DELETE /api/financeiro/dre?ano=2026
export async function DELETE(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Apenas administradores podem excluir registros." }, { status: 403 });
  }
  if (!process.env.DATABASE_URL) return NextResponse.json({ sucesso: true });
  const sql = getDb();
  try {
    await ensureTable(sql);
    const { searchParams } = new URL(request.url);
    const ano = searchParams.get("ano");

    if (ano) {
      await sql`DELETE FROM "DreLinha" WHERE ano = ${Number(ano)}`;
    } else {
      await sql`DELETE FROM "DreLinha"`;
    }

    return NextResponse.json({ sucesso: true });
  } catch (error) {
    return NextResponse.json({ error: "Erro ao deletar" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
