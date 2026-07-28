import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";

// Impede pré-renderização estática no build — necessário para rotas com banco de dados
export const dynamic = "force-dynamic";

function getDb() {
  return postgres(process.env.DATABASE_URL as string, { ssl: "require" });
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
  } catch (error) {
    console.error("[GET /api/performance/comissoes]", error);
    return NextResponse.json({ error: "Erro ao buscar comissões" }, { status: 500 });
  } finally {
    await sql.end();
  }
}

// POST /api/performance/comissoes — substitui o mês inteiro do profissional
export async function POST(request: NextRequest) {
  const sql = getDb();
  try {
    await ensureTables(sql);
    const body = await request.json();
    const { registros, mesAno, profissional } = body;

    if (!registros || !Array.isArray(registros) || registros.length === 0) {
      return NextResponse.json({ error: "Nenhum registro recebido" }, { status: 400 });
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
  } catch (error) {
    console.error("[POST /api/performance/comissoes]", error);
    return NextResponse.json({ error: "Erro ao salvar comissões" }, { status: 500 });
  } finally {
    await sql.end();
  }
}

// DELETE /api/performance/comissoes?profissional=X&mesAno=Y
export async function DELETE(request: NextRequest) {
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
    console.error("[DELETE /api/performance/comissoes]", error);
    return NextResponse.json({ error: "Erro ao deletar comissões" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
