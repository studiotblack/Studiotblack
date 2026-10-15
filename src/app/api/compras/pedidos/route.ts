import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/financeiro-db";
import { ensureComprasTables } from "@/lib/compras-db";

export const dynamic = "force-dynamic";

// PATCH /api/compras/pedidos — atualiza o status de itens pedidos.
//   { acao: "comprar", itens: [{ id, quantidadeComprada?, valor? }], dataCompra? }
//   { acao: "reabrir", ids: [...] }   — desfaz "comprado" (só se ainda não foi pro Contas a Pagar)
export async function PATCH(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Variável DATABASE_URL não configurada." }, { status: 500 });
  const sql = getDb();
  try {
    await ensureComprasTables(sql);
    const b = await request.json();

    if (b.acao === "comprar") {
      const itens: { id: string; quantidadeComprada?: number | null; valor?: number | null }[] = Array.isArray(b.itens) ? b.itens : [];
      if (itens.length === 0) return NextResponse.json({ error: "Nenhum item informado." }, { status: 400 });
      const data = /^\d{4}-\d{2}-\d{2}$/.test(String(b.dataCompra ?? ""))
        ? String(b.dataCompra)
        : new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
      await sql.begin(async (tx) => {
        for (const it of itens) {
          const qtd = it.quantidadeComprada != null && Number(it.quantidadeComprada) > 0 ? Math.floor(Number(it.quantidadeComprada)) : null;
          const valor = it.valor != null && Number(it.valor) >= 0 ? Number(it.valor) : null;
          await tx`
            UPDATE "CompraPedidoItem"
            SET status = 'comprado', "dataCompra" = ${data}, "quantidadeComprada" = ${qtd}, valor = ${valor}
            WHERE id = ${it.id} AND "lancamentoId" IS NULL
          `;
        }
      });
      return NextResponse.json({ ok: true });
    }

    if (b.acao === "reabrir") {
      const ids: string[] = Array.isArray(b.ids) ? b.ids.map(String) : [];
      if (ids.length === 0) return NextResponse.json({ error: "Nenhum item informado." }, { status: 400 });
      await sql`
        UPDATE "CompraPedidoItem" SET status = 'pendente', "dataCompra" = NULL, "quantidadeComprada" = NULL, valor = NULL
        WHERE id IN ${sql(ids)} AND "lancamentoId" IS NULL
      `;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error: any) {
    console.error("[PATCH /api/compras/pedidos]", error);
    return NextResponse.json({ error: error?.message || "Erro ao atualizar pedido" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
