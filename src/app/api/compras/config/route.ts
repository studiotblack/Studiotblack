import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/financeiro-db";
import { ensureComprasTables } from "@/lib/compras-db";

export const dynamic = "force-dynamic";

// GET /api/compras/config — destino do aviso por WhatsApp
export async function GET() {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Variável DATABASE_URL não configurada." }, { status: 500 });
  const sql = getDb();
  try {
    await ensureComprasTables(sql);
    const [cfg] = await sql`SELECT "whatsappDestino" FROM "CompraConfig" WHERE id = 'default'`;
    return NextResponse.json({ whatsappDestino: cfg?.whatsappDestino ?? "" });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Erro ao carregar" }, { status: 500 });
  } finally {
    await sql.end();
  }
}

// PATCH /api/compras/config — { whatsappDestino } (qualquer formatação; guarda só os dígitos;
// vazio volta a usar o grupo de avisos)
export async function PATCH(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Variável DATABASE_URL não configurada." }, { status: 500 });
  const sql = getDb();
  try {
    await ensureComprasTables(sql);
    const b = await request.json();
    let digitos = String(b.whatsappDestino ?? "").replace(/\D/g, "");
    if (digitos && digitos.length <= 11) digitos = `55${digitos}`; // sem DDI: assume Brasil
    if (digitos && (digitos.length < 12 || digitos.length > 13)) {
      return NextResponse.json({ error: "Número inválido. Use DDD + número (ex.: 12 98834-0011)." }, { status: 400 });
    }
    await sql`UPDATE "CompraConfig" SET "whatsappDestino" = ${digitos || null}, "updatedAt" = NOW() WHERE id = 'default'`;
    return NextResponse.json({ whatsappDestino: digitos });
  } catch (error: any) {
    console.error("[PATCH /api/compras/config]", error);
    return NextResponse.json({ error: error?.message || "Erro ao salvar" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
