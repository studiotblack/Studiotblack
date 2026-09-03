import { NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";
import { registrarParcelasCartao } from "@/lib/whatsapp/cartao-credito";

export const dynamic = "force-dynamic";

// POST /api/financeiro/whatsapp/comprovantes/[id]/marcar-cartao
// Marca manualmente um comprovante como compra no cartão de crédito — cobre o caso de a
// legenda não ter vindo com "cartao" da primeira vez (ex: o usuário editou a legenda em
// vez de reenviar a foto, e a edição nunca chegou como mensagem nova), ou do OCR não ter
// conseguido ler o valor/parcela sozinho. Não depende de nenhuma legenda: o usuário digita
// direto quantas parcelas e o valor de cada uma.
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Variável DATABASE_URL não configurada." }, { status: 500 });
  }
  const { id } = await ctx.params;
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const b = await request.json();
    const parcelas = Number(b.parcelas) || 1;
    const valorParcela = Number(b.valorParcela);
    if (!valorParcela || valorParcela <= 0) {
      return NextResponse.json({ error: "valorParcela precisa ser um número maior que zero" }, { status: 400 });
    }

    const [comp] = await sql`SELECT * FROM "WhatsappComprovante" WHERE id = ${id}`;
    if (!comp) return NextResponse.json({ error: "Comprovante não encontrado" }, { status: 404 });

    await registrarParcelasCartao(sql, {
      whatsappComprovanteId: comp.id,
      descricao: comp.textoLegenda,
      dataCompra: new Date(comp.dataHoraEnvio),
      parcelas,
      valorParcela,
    });
    await sql`UPDATE "WhatsappComprovante" SET status = 'cartao_registrado' WHERE id = ${id}`;

    return NextResponse.json({ ok: true, parcelas, valorParcela });
  } catch (error: any) {
    console.error("[POST /api/financeiro/whatsapp/comprovantes/[id]/marcar-cartao]", error);
    return NextResponse.json({ error: error?.message || "Erro ao marcar compra no cartão" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
