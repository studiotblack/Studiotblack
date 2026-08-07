import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.DATABASE_URL) return NextResponse.json([], { status: 200 });
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const rows = await sql`
      SELECT t.*, co.nome AS "contaOrigemNome", cd.nome AS "contaDestinoNome"
      FROM "Transferencia" t
      JOIN "ContaBancaria" co ON co.id = t."contaOrigemId"
      JOIN "ContaBancaria" cd ON cd.id = t."contaDestinoId"
      ORDER BY t.data DESC
    `;
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("[GET /api/financeiro/transferencias]", error);
    return NextResponse.json({ error: error?.message || "Erro ao buscar transferências" }, { status: 500 });
  } finally {
    await sql.end();
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Variável DATABASE_URL não configurada." }, { status: 500 });
  }
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const b = await request.json();

    if (!b.contaOrigemId || !b.contaDestinoId || !b.valor || !b.data) {
      return NextResponse.json({ error: "contaOrigemId, contaDestinoId, valor e data são obrigatórios" }, { status: 400 });
    }
    if (b.contaOrigemId === b.contaDestinoId) {
      return NextResponse.json({ error: "Conta de origem e destino não podem ser a mesma" }, { status: 400 });
    }

    const [row] = await sql`
      INSERT INTO "Transferencia" ("contaOrigemId", "contaDestinoId", valor, data, descricao)
      VALUES (${b.contaOrigemId}, ${b.contaDestinoId}, ${b.valor}, ${b.data}, ${b.descricao ?? null})
      RETURNING *
    `;

    return NextResponse.json(row);
  } catch (error: any) {
    console.error("[POST /api/financeiro/transferencias]", error);
    return NextResponse.json({ error: error?.message || "Erro ao salvar transferência" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
