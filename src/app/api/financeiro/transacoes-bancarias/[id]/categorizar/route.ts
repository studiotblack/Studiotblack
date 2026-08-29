import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";

export const dynamic = "force-dynamic";

// POST /api/financeiro/transacoes-bancarias/[id]/categorizar
// Atribui (ou troca) a categoria do lançamento já conciliado dessa transação — usado
// principalmente pelos lançamentos criados automaticamente via comprovante do WhatsApp
// sem categoria reconhecida (match de valor+data só, sem palavra-chave no dicionário).
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Variável DATABASE_URL não configurada." }, { status: 500 });
  }
  const { id } = await ctx.params;
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const b = await request.json();
    if (!b.categoriaId) return NextResponse.json({ error: "categoriaId é obrigatório" }, { status: 400 });

    const [transacao] = await sql`SELECT * FROM "TransacaoBancariaImportada" WHERE id = ${id}`;
    if (!transacao) return NextResponse.json({ error: "Transação não encontrada" }, { status: 404 });
    if (!transacao.lancamentoId) {
      return NextResponse.json({ error: "Esta transação ainda não está conciliada" }, { status: 400 });
    }

    await sql.begin(async (sql) => {
      await sql`DELETE FROM "LancamentoFinanceiroCategoria" WHERE "lancamentoId" = ${transacao.lancamentoId}`;
      await sql`
        INSERT INTO "LancamentoFinanceiroCategoria" ("lancamentoId", "categoriaId", valor)
        VALUES (${transacao.lancamentoId}, ${b.categoriaId}, ${transacao.valor})
      `;
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[POST /api/financeiro/transacoes-bancarias/[id]/categorizar]", error);
    return NextResponse.json({ error: error?.message || "Erro ao categorizar transação" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
