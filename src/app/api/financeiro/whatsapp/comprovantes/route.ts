import { NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";

export const dynamic = "force-dynamic";

// GET /api/financeiro/whatsapp/comprovantes
// Lista persistente dos comprovantes do WhatsApp que ainda precisam de alguma ação —
// diferente do resumo da última sincronização (que some ao recarregar a página), essa
// lista vem direto do banco e continua aparecendo até o usuário resolver cada um (editar
// o valor, marcar como cartão, ou ignorar).
export async function GET() {
  if (!process.env.DATABASE_URL) return NextResponse.json([]);
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const rows = await sql`
      SELECT c.*, cat.nome AS "categoriaSugeridaNome"
      FROM "WhatsappComprovante" c
      LEFT JOIN "CategoriaFinanceira" cat ON cat.id = c."categoriaSugeridaId"
      WHERE c.status IN ('pendente', 'erro_cartao')
      ORDER BY c."dataHoraEnvio" DESC
    `;
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("[GET /api/financeiro/whatsapp/comprovantes]", error);
    return NextResponse.json({ error: error?.message || "Erro ao buscar comprovantes" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
