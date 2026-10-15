import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/financeiro-db";
import { ensureComprasTables, gerarToken } from "@/lib/compras-db";
import { isAdminRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

// POST /api/compras/token — troca o token do link público (o link antigo para de funcionar).
export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Apenas administradores podem trocar o link." }, { status: 403 });
  }
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Variável DATABASE_URL não configurada." }, { status: 500 });
  const sql = getDb();
  try {
    await ensureComprasTables(sql);
    const token = gerarToken();
    await sql`UPDATE "CompraConfig" SET token = ${token}, "updatedAt" = NOW() WHERE id = 'default'`;
    return NextResponse.json({ token });
  } catch (error: any) {
    console.error("[POST /api/compras/token]", error);
    return NextResponse.json({ error: error?.message || "Erro ao trocar o link" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
