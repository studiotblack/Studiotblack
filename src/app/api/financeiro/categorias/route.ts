import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";
import { isAdminRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.DATABASE_URL) return NextResponse.json([], { status: 200 });
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const rows = await sql`SELECT * FROM "CategoriaFinanceira" ORDER BY grupo ASC, nome ASC`;
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("[GET /api/financeiro/categorias]", error);
    return NextResponse.json({ error: error?.message || "Erro ao buscar categorias" }, { status: 500 });
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
    if (!b.grupo || !b.nome || !b.tipo) {
      return NextResponse.json({ error: "grupo, nome e tipo são obrigatórios" }, { status: 400 });
    }
    const [row] = await sql`
      INSERT INTO "CategoriaFinanceira" (codigo, grupo, "categoriaPai", nome, tipo)
      VALUES (${b.codigo ?? null}, ${b.grupo}, ${b.categoriaPai ?? null}, ${b.nome}, ${b.tipo})
      RETURNING *
    `;
    return NextResponse.json(row);
  } catch (error: any) {
    console.error("[POST /api/financeiro/categorias]", error);
    return NextResponse.json({ error: error?.message || "Erro ao salvar categoria" }, { status: 500 });
  } finally {
    await sql.end();
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Apenas administradores podem excluir registros." }, { status: 403 });
  }
  if (!process.env.DATABASE_URL) return NextResponse.json({ sucesso: true });
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
    await sql`DELETE FROM "CategoriaFinanceira" WHERE id = ${id}`;
    return NextResponse.json({ sucesso: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Erro ao excluir (verifique se não está em uso por algum lançamento)" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
