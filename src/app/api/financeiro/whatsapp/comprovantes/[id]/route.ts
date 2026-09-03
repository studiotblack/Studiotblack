import { NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";
import { tentarVincularComprovante } from "@/lib/whatsapp/vincular-comprovante";

export const dynamic = "force-dynamic";

// PATCH /api/financeiro/whatsapp/comprovantes/[id]
// Dois usos: { ignorar: true } marca o comprovante como resolvido sem gerar nada (some da
// lista); { valorOcr } corrige o valor (quando o OCR não leu nada ou leu errado) e já
// tenta vincular contra o extrato bancário na hora, sem esperar a próxima sincronização
// inteira do WhatsApp rodar de novo.
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Variável DATABASE_URL não configurada." }, { status: 500 });
  }
  const { id } = await ctx.params;
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const b = await request.json();

    if (b.ignorar) {
      const [row] = await sql`UPDATE "WhatsappComprovante" SET status = 'ignorado' WHERE id = ${id} RETURNING *`;
      if (!row) return NextResponse.json({ error: "Comprovante não encontrado" }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    if (typeof b.valorOcr !== "number" || b.valorOcr <= 0) {
      return NextResponse.json({ error: "valorOcr precisa ser um número maior que zero" }, { status: 400 });
    }

    const [comp] = await sql`
      UPDATE "WhatsappComprovante" SET "valorOcr" = ${b.valorOcr}, status = 'pendente' WHERE id = ${id} RETURNING *
    `;
    if (!comp) return NextResponse.json({ error: "Comprovante não encontrado" }, { status: 404 });

    const resultado = await tentarVincularComprovante(sql, comp);
    return NextResponse.json({ ok: true, resultado });
  } catch (error: any) {
    console.error("[PATCH /api/financeiro/whatsapp/comprovantes/[id]]", error);
    return NextResponse.json({ error: error?.message || "Erro ao editar comprovante" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
