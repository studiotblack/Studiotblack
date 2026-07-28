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

// Garante que as tabelas existem
async function ensureTables(sql: ReturnType<typeof postgres>) {
  await sql`
    CREATE TABLE IF NOT EXISTS "DesempenhoProfissionalDB" (
      id TEXT PRIMARY KEY,
      profissional TEXT NOT NULL,
      item TEXT NOT NULL,
      data TEXT NOT NULL,
      "valorBruto" FLOAT NOT NULL,
      "valorComissao" FLOAT NOT NULL,
      pagamento TEXT,
      percentual FLOAT,
      cliente TEXT NOT NULL,
      pago BOOLEAN NOT NULL DEFAULT false,
      "mesAno" TEXT NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_desemp_prof_mes ON "DesempenhoProfissionalDB" (profissional, "mesAno")`;
}

// GET /api/performance/comissoes
export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json([], { status: 200 }); // Retorna vazio se ainda não configurou no Vercel
  }
  const sql = getDb();
  try {
    await ensureTables(sql);
    const { searchParams } = new URL(request.url);
    const mesAno = searchParams.get("mesAno");
    const profissional = searchParams.get("profissional");

    let rows;
    if (mesAno && profissional) {
      rows = await sql`SELECT * FROM "DesempenhoProfissionalDB" WHERE profissional = ${profissional} AND "mesAno" = ${mesAno} ORDER BY data ASC`;
    } else if (mesAno) {
      rows = await sql`SELECT * FROM "DesempenhoProfissionalDB" WHERE "mesAno" = ${mesAno} ORDER BY data ASC`;
    } else if (profissional) {
      rows = await sql`SELECT * FROM "DesempenhoProfissionalDB" WHERE profissional = ${profissional} ORDER BY data ASC`;
    } else {
      rows = await sql`SELECT * FROM "DesempenhoProfissionalDB" ORDER BY data ASC`;
    }

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("[GET /api/performance/comissoes]", error);
    return NextResponse.json({ error: error?.message || "Erro ao buscar comissões" }, { status: 500 });
  } finally {
    await sql.end();
  }
}

// POST /api/performance/comissoes — substitui o mês inteiro do profissional
export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Variável DATABASE_URL não configurada no Vercel. Adicione em Settings -> Environment Variables." }, { status: 500 });
  }
  const sql = getDb();
  try {
    await ensureTables(sql);
    const body = await request.json();
    const { registros, mesAno, profissional } = body;

    if (!registros || !Array.isArray(registros) || registros.length === 0) {
      return NextResponse.json({ error: "Nenhum registro recebido no arquivo" }, { status: 400 });
    }

    // Apaga registros anteriores do mesmo profissional+mês
    await sql`DELETE FROM "DesempenhoProfissionalDB" WHERE profissional = ${profissional} AND "mesAno" = ${mesAno}`;

    // Insere os novos registros em lote
    let inseridos = 0;
    for (const r of registros) {
      await sql`
        INSERT INTO "DesempenhoProfissionalDB" (id, profissional, item, data, "valorBruto", "valorComissao", pagamento, percentual, cliente, pago, "mesAno")
        VALUES (${r.id}, ${r.profissional}, ${r.item}, ${r.data}, ${r.valorBruto}, ${r.valorComissao}, ${r.pagamento ?? null}, ${r.percentual ?? null}, ${r.cliente}, ${r.pago ?? false}, ${r.mesAno})
        ON CONFLICT (id) DO UPDATE SET
          profissional = EXCLUDED.profissional,
          item = EXCLUDED.item,
          data = EXCLUDED.data,
          "valorBruto" = EXCLUDED."valorBruto",
          "valorComissao" = EXCLUDED."valorComissao",
          pagamento = EXCLUDED.pagamento,
          percentual = EXCLUDED.percentual,
          cliente = EXCLUDED.cliente,
          pago = EXCLUDED.pago,
          "mesAno" = EXCLUDED."mesAno"
      `;
      inseridos++;
    }

    return NextResponse.json({ sucesso: true, inseridos, profissional, mesAno });
  } catch (error: any) {
    console.error("[POST /api/performance/comissoes]", error);
    return NextResponse.json({ error: error?.message || "Erro ao salvar comissões no banco" }, { status: 500 });
  } finally {
    await sql.end();
  }
}

// DELETE /api/performance/comissoes
export async function DELETE(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ sucesso: true });
  const sql = getDb();
  try {
    await ensureTables(sql);
    const { searchParams } = new URL(request.url);
    const mesAno = searchParams.get("mesAno");
    const profissional = searchParams.get("profissional");

    if (mesAno && profissional) {
      await sql`DELETE FROM "DesempenhoProfissionalDB" WHERE profissional = ${profissional} AND "mesAno" = ${mesAno}`;
    } else if (profissional) {
      await sql`DELETE FROM "DesempenhoProfissionalDB" WHERE profissional = ${profissional}`;
    } else if (mesAno) {
      await sql`DELETE FROM "DesempenhoProfissionalDB" WHERE "mesAno" = ${mesAno}`;
    }

    return NextResponse.json({ sucesso: true });
  } catch (error) {
    return NextResponse.json({ error: "Erro ao deletar" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
