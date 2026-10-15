import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/financeiro-db";
import { ensureComprasTables } from "@/lib/compras-db";
import { isAdminRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

// PATCH /api/compras/itens/[id] — edita nome/setor/tipo, ativa/desativa ou aprova uma sugestão
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Variável DATABASE_URL não configurada." }, { status: 500 });
  const { id } = await ctx.params;
  const sql = getDb();
  try {
    await ensureComprasTables(sql);
    const b = await request.json();
    const [atual] = await sql`SELECT * FROM "CompraItem" WHERE id = ${id}`;
    if (!atual) return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });

    const setor = b.setor !== undefined ? String(b.setor).trim().slice(0, 40) || atual.setor : atual.setor;
    const nome = b.nome !== undefined ? String(b.nome).trim().slice(0, 80) || atual.nome : atual.nome;
    const tipo = b.tipo === "consumo" || b.tipo === "revenda" ? b.tipo : atual.tipo;
    const ativo = typeof b.ativo === "boolean" ? b.ativo : atual.ativo;
    const aprovado = typeof b.aprovado === "boolean" ? b.aprovado : atual.aprovado;
    let ordem = atual.ordem;
    if (aprovado && !atual.aprovado) {
      // sugestão aprovada entra no fim da lista (a ordem de 9999 era só pra ficar por último)
      const [{ proxima }] = await sql`SELECT COALESCE(MAX(ordem), 0) + 1 AS proxima FROM "CompraItem" WHERE ordem < 9999`;
      ordem = proxima;
    }

    const [row] = await sql`
      UPDATE "CompraItem" SET setor = ${setor}, nome = ${nome}, tipo = ${tipo}, ativo = ${ativo}, aprovado = ${aprovado}, ordem = ${ordem}
      WHERE id = ${id} RETURNING *
    `;
    return NextResponse.json(row);
  } catch (error: any) {
    console.error("[PATCH /api/compras/itens/[id]]", error);
    return NextResponse.json({ error: error?.message || "Erro ao salvar item" }, { status: 500 });
  } finally {
    await sql.end();
  }
}

// DELETE — só remove item que nunca foi pedido (senão o histórico de giro se perderia);
// quem já tem pedido deve ser desativado.
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Apenas administradores podem excluir registros." }, { status: 403 });
  }
  if (!process.env.DATABASE_URL) return NextResponse.json({ sucesso: true });
  const { id } = await ctx.params;
  const sql = getDb();
  try {
    await ensureComprasTables(sql);
    const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM "CompraPedidoItem" WHERE "itemId" = ${id}`;
    if (n > 0) {
      return NextResponse.json({ error: "Este item já foi pedido — desative em vez de excluir, para manter o histórico." }, { status: 400 });
    }
    await sql`DELETE FROM "CompraItem" WHERE id = ${id}`;
    return NextResponse.json({ sucesso: true });
  } catch (error: any) {
    console.error("[DELETE /api/compras/itens/[id]]", error);
    return NextResponse.json({ error: error?.message || "Erro ao excluir item" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
