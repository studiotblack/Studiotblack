import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";
import { isAdminRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json([], { status: 200 });
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get("tipo");
    const rows = tipo
      ? await sql`SELECT * FROM "Contato" WHERE ${tipo} = ANY(tipos) ORDER BY ativo DESC, nome ASC`
      : await sql`SELECT * FROM "Contato" ORDER BY ativo DESC, nome ASC`;
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("[GET /api/financeiro/contatos]", error);
    return NextResponse.json({ error: error?.message || "Erro ao buscar contatos" }, { status: 500 });
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
    if (!b.nome || !Array.isArray(b.tipos) || b.tipos.length === 0) {
      return NextResponse.json({ error: "nome e ao menos um tipo são obrigatórios" }, { status: 400 });
    }
    const [row] = await sql`
      INSERT INTO "Contato" (nome, "cpfCnpj", tipos, email, telefone, observacoes, ativo)
      VALUES (${b.nome}, ${b.cpfCnpj ?? null}, ${sql.array(b.tipos)}::text[], ${b.email ?? null}, ${b.telefone ?? null}, ${b.observacoes ?? null}, ${b.ativo ?? true})
      RETURNING *
    `;
    return NextResponse.json(row);
  } catch (error: any) {
    console.error("[POST /api/financeiro/contatos]", error);
    return NextResponse.json({ error: error?.message || "Erro ao salvar contato" }, { status: 500 });
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
    await sql`UPDATE "Contato" SET ativo = false, "updatedAt" = NOW() WHERE id = ${id}`;
    return NextResponse.json({ sucesso: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Erro ao excluir" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
