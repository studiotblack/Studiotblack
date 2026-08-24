import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";

export const dynamic = "force-dynamic";

// GET /api/financeiro/meta — meta de faturamento mensal do negócio (linha única)
export async function GET() {
  if (!process.env.DATABASE_URL) return NextResponse.json({ metaReceitaMensal: 0 });
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const [row] = await sql`SELECT "metaReceitaMensal", "whatsappGrupoJid" FROM "MetaFinanceira" WHERE id = 'default'`;
    return NextResponse.json({ metaReceitaMensal: row?.metaReceitaMensal ?? 0, whatsappGrupoJid: row?.whatsappGrupoJid ?? null });
  } catch (error: any) {
    console.error("[GET /api/financeiro/meta]", error);
    return NextResponse.json({ error: error?.message || "Erro ao buscar meta" }, { status: 500 });
  } finally {
    await sql.end();
  }
}

// PUT /api/financeiro/meta — atualiza a meta de faturamento mensal
export async function PUT(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Variável DATABASE_URL não configurada." }, { status: 500 });
  }
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const body = await request.json();
    const { metaReceitaMensal, whatsappGrupoJid } = body;
    if (metaReceitaMensal !== undefined && (typeof metaReceitaMensal !== "number" || metaReceitaMensal < 0)) {
      return NextResponse.json({ error: "metaReceitaMensal precisa ser um número válido" }, { status: 400 });
    }
    const [existente] = await sql`SELECT "metaReceitaMensal", "whatsappGrupoJid" FROM "MetaFinanceira" WHERE id = 'default'`;
    const novaMeta = metaReceitaMensal ?? existente?.metaReceitaMensal ?? 0;
    const novoJid = whatsappGrupoJid !== undefined ? whatsappGrupoJid : (existente?.whatsappGrupoJid ?? null);
    const [row] = await sql`
      INSERT INTO "MetaFinanceira" (id, "metaReceitaMensal", "whatsappGrupoJid", "updatedAt")
      VALUES ('default', ${novaMeta}, ${novoJid}, NOW())
      ON CONFLICT (id) DO UPDATE SET "metaReceitaMensal" = EXCLUDED."metaReceitaMensal", "whatsappGrupoJid" = EXCLUDED."whatsappGrupoJid", "updatedAt" = NOW()
      RETURNING "metaReceitaMensal", "whatsappGrupoJid"
    `;
    return NextResponse.json({ metaReceitaMensal: row.metaReceitaMensal, whatsappGrupoJid: row.whatsappGrupoJid });
  } catch (error: any) {
    console.error("[PUT /api/financeiro/meta]", error);
    return NextResponse.json({ error: error?.message || "Erro ao salvar meta" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
