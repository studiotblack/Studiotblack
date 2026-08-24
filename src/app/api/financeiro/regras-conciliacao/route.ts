import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";

export const dynamic = "force-dynamic";

// GET /api/financeiro/regras-conciliacao — regras aprendidas de "descrição do banco -> contato/categoria/centro"
// usadas pra conciliar automaticamente transações futuras parecidas sem repetir o trabalho manual.
export async function GET() {
  if (!process.env.DATABASE_URL) return NextResponse.json([], { status: 200 });
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const rows = await sql`
      SELECT r.*, c.nome AS "contatoNome", cat.nome AS "categoriaNome", cc.nome AS "centroCustoNome"
      FROM "RegraConciliacaoBancaria" r
      JOIN "Contato" c ON c.id = r."contatoId"
      LEFT JOIN "CategoriaFinanceira" cat ON cat.id = r."categoriaId"
      LEFT JOIN "CentroCusto" cc ON cc.id = r."centroCustoId"
      ORDER BY r."padraoDescricao" ASC
    `;
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("[GET /api/financeiro/regras-conciliacao]", error);
    return NextResponse.json({ error: error?.message || "Erro ao buscar regras" }, { status: 500 });
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
    if (!b.padraoDescricao || !b.contatoId) {
      return NextResponse.json({ error: "padraoDescricao e contatoId são obrigatórios" }, { status: 400 });
    }
    const [row] = await sql`
      INSERT INTO "RegraConciliacaoBancaria" (id, "padraoDescricao", "contatoId", "categoriaId", "centroCustoId", descricao)
      VALUES (gen_random_uuid()::text, ${b.padraoDescricao.toLowerCase().trim()}, ${b.contatoId}, ${b.categoriaId ?? null}, ${b.centroCustoId ?? null}, ${b.descricao ?? null})
      ON CONFLICT ("padraoDescricao") DO UPDATE SET
        "contatoId" = EXCLUDED."contatoId", "categoriaId" = EXCLUDED."categoriaId",
        "centroCustoId" = EXCLUDED."centroCustoId", descricao = EXCLUDED.descricao
      RETURNING *
    `;
    return NextResponse.json(row);
  } catch (error: any) {
    console.error("[POST /api/financeiro/regras-conciliacao]", error);
    return NextResponse.json({ error: error?.message || "Erro ao salvar regra" }, { status: 500 });
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
    await sql`DELETE FROM "RegraConciliacaoBancaria" WHERE id = ${id}`;
    return NextResponse.json({ sucesso: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Erro ao excluir" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
