import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";

export const dynamic = "force-dynamic";

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Variável DATABASE_URL não configurada no servidor.");
  }
  return postgres(url, { ssl: "require" });
}

// Garante que a tabela existe
async function ensureTable(sql: ReturnType<typeof postgres>) {
  await sql`
    CREATE TABLE IF NOT EXISTS "TaxaOcupacao" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      profissional TEXT NOT NULL,
      "mesAno" TEXT NOT NULL,
      "taxaOcupacao" FLOAT NOT NULL,
      "taxaOcupacaoComBloqueios" FLOAT NOT NULL,
      "tempoAtendimentoStr" TEXT NOT NULL,
      "tempoBloqueadoStr" TEXT NOT NULL,
      "tempoJornadaStr" TEXT NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(profissional, "mesAno")
    )
  `;
}

// GET /api/performance/ocupacao
export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json([], { status: 200 });
  }
  const sql = getDb();
  try {
    await ensureTable(sql);
    const { searchParams } = new URL(request.url);
    const mesAno = searchParams.get("mesAno");
    const profissional = searchParams.get("profissional");

    let rows;
    if (mesAno && profissional) {
      rows = await sql`SELECT * FROM "TaxaOcupacao" WHERE profissional = ${profissional} AND "mesAno" = ${mesAno} ORDER BY profissional ASC`;
    } else if (profissional) {
      rows = await sql`SELECT * FROM "TaxaOcupacao" WHERE profissional = ${profissional} ORDER BY "mesAno" ASC`;
    } else if (mesAno) {
      rows = await sql`SELECT * FROM "TaxaOcupacao" WHERE "mesAno" = ${mesAno} ORDER BY profissional ASC`;
    } else {
      rows = await sql`SELECT * FROM "TaxaOcupacao" ORDER BY profissional ASC, "mesAno" ASC`;
    }

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("[GET /api/performance/ocupacao]", error);
    return NextResponse.json({ error: error?.message || "Erro ao buscar ocupação" }, { status: 500 });
  } finally {
    await sql.end();
  }
}

// POST /api/performance/ocupacao
export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Variável DATABASE_URL não configurada no Vercel. Adicione em Settings -> Environment Variables." }, { status: 500 });
  }
  const sql = getDb();
  try {
    await ensureTable(sql);
    const taxa = await request.json();

    if (!taxa.profissional || !taxa.mesAno) {
      return NextResponse.json({ error: "profissional e mesAno são obrigatórios" }, { status: 400 });
    }

    await sql`
      INSERT INTO "TaxaOcupacao" (id, profissional, "mesAno", "taxaOcupacao", "taxaOcupacaoComBloqueios", "tempoAtendimentoStr", "tempoBloqueadoStr", "tempoJornadaStr")
      VALUES (
        gen_random_uuid()::text,
        ${taxa.profissional},
        ${taxa.mesAno},
        ${taxa.taxaOcupacao},
        ${taxa.taxaOcupacaoComBloqueios},
        ${taxa.tempoAtendimentoStr},
        ${taxa.tempoBloqueadoStr},
        ${taxa.tempoJornadaStr}
      )
      ON CONFLICT (profissional, "mesAno") DO UPDATE SET
        "taxaOcupacao" = EXCLUDED."taxaOcupacao",
        "taxaOcupacaoComBloqueios" = EXCLUDED."taxaOcupacaoComBloqueios",
        "tempoAtendimentoStr" = EXCLUDED."tempoAtendimentoStr",
        "tempoBloqueadoStr" = EXCLUDED."tempoBloqueadoStr",
        "tempoJornadaStr" = EXCLUDED."tempoJornadaStr",
        "updatedAt" = NOW()
    `;

    return NextResponse.json({ sucesso: true });
  } catch (error: any) {
    console.error("[POST /api/performance/ocupacao]", error);
    return NextResponse.json({ error: error?.message || "Erro ao salvar taxa de ocupação" }, { status: 500 });
  } finally {
    await sql.end();
  }
}

// DELETE /api/performance/ocupacao
export async function DELETE(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ sucesso: true });
  const sql = getDb();
  try {
    await ensureTable(sql);
    const { searchParams } = new URL(request.url);
    const mesAno = searchParams.get("mesAno");
    const profissional = searchParams.get("profissional");

    if (mesAno && profissional) {
      await sql`DELETE FROM "TaxaOcupacao" WHERE profissional = ${profissional} AND "mesAno" = ${mesAno}`;
    } else if (profissional) {
      await sql`DELETE FROM "TaxaOcupacao" WHERE profissional = ${profissional}`;
    } else if (mesAno) {
      await sql`DELETE FROM "TaxaOcupacao" WHERE "mesAno" = ${mesAno}`;
    }

    return NextResponse.json({ sucesso: true });
  } catch (error) {
    return NextResponse.json({ error: "Erro ao deletar" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
