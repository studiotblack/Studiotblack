import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";

export const dynamic = "force-dynamic";

// GET /api/financeiro/palavras-chave — dicionário palavra-chave -> categoria de saída,
// usado pra decidir a categoria dos comprovantes do WhatsApp automaticamente.
export async function GET() {
  if (!process.env.DATABASE_URL) return NextResponse.json([], { status: 200 });
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const rows = await sql`
      SELECT pc.*, cat.nome AS "categoriaNome"
      FROM "CategoriaPalavraChave" pc
      JOIN "CategoriaFinanceira" cat ON cat.id = pc."categoriaId"
      ORDER BY pc."palavraChave" ASC
    `;
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("[GET /api/financeiro/palavras-chave]", error);
    return NextResponse.json({ error: error?.message || "Erro ao buscar palavras-chave" }, { status: 500 });
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
    if (!b.palavraChave || !b.categoriaId) {
      return NextResponse.json({ error: "palavraChave e categoriaId são obrigatórios" }, { status: 400 });
    }
    const [row] = await sql`
      INSERT INTO "CategoriaPalavraChave" (id, "palavraChave", "categoriaId")
      VALUES (gen_random_uuid()::text, ${b.palavraChave.toLowerCase().trim()}, ${b.categoriaId})
      ON CONFLICT ("palavraChave") DO UPDATE SET "categoriaId" = EXCLUDED."categoriaId"
      RETURNING *
    `;
    return NextResponse.json(row);
  } catch (error: any) {
    console.error("[POST /api/financeiro/palavras-chave]", error);
    return NextResponse.json({ error: error?.message || "Erro ao salvar palavra-chave" }, { status: 500 });
  } finally {
    await sql.end();
  }
}

export async function DELETE(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ sucesso: true });
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
    await sql`DELETE FROM "CategoriaPalavraChave" WHERE id = ${id}`;
    return NextResponse.json({ sucesso: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Erro ao excluir" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
