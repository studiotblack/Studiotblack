import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";
import { isAdminRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.DATABASE_URL) return NextResponse.json([], { status: 200 });
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const rows = await sql`SELECT * FROM "ContaBancaria" ORDER BY ativa DESC, nome ASC`;
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("[GET /api/financeiro/contas-bancarias]", error);
    return NextResponse.json({ error: error?.message || "Erro ao buscar contas bancárias" }, { status: 500 });
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
    if (!b.nome || !b.banco || !b.dataSaldoInicial) {
      return NextResponse.json({ error: "nome, banco e dataSaldoInicial são obrigatórios" }, { status: 400 });
    }
    const [row] = await sql`
      INSERT INTO "ContaBancaria" (nome, banco, "tipoConta", agencia, conta, "saldoInicial", "dataSaldoInicial", ativa)
      VALUES (${b.nome}, ${b.banco}, ${b.tipoConta || "Conta corrente"}, ${b.agencia ?? null}, ${b.conta ?? null}, ${b.saldoInicial ?? 0}, ${b.dataSaldoInicial}, ${b.ativa ?? true})
      RETURNING *
    `;
    return NextResponse.json(row);
  } catch (error: any) {
    console.error("[POST /api/financeiro/contas-bancarias]", error);
    return NextResponse.json({ error: error?.message || "Erro ao salvar conta bancária" }, { status: 500 });
  } finally {
    await sql.end();
  }
}

// PUT /api/financeiro/contas-bancarias — edita uma conta existente (inclui config Sicoob)
export async function PUT(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Variável DATABASE_URL não configurada." }, { status: 500 });
  }
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const b = await request.json();
    if (!b.id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

    const [row] = await sql`
      UPDATE "ContaBancaria" SET
        nome = COALESCE(${b.nome ?? null}, nome),
        banco = COALESCE(${b.banco ?? null}, banco),
        "tipoConta" = COALESCE(${b.tipoConta ?? null}, "tipoConta"),
        agencia = COALESCE(${b.agencia ?? null}, agencia),
        conta = COALESCE(${b.conta ?? null}, conta),
        "sicoobClientId" = COALESCE(${b.sicoobClientId ?? null}, "sicoobClientId"),
        "sicoobCertificado" = COALESCE(${b.sicoobCertificado ?? null}, "sicoobCertificado"),
        "sicoobChavePrivada" = COALESCE(${b.sicoobChavePrivada ?? null}, "sicoobChavePrivada"),
        "sicoobNumeroConta" = COALESCE(${b.sicoobNumeroConta ?? null}, "sicoobNumeroConta"),
        "regraEntradaAtiva" = COALESCE(${typeof b.regraEntradaAtiva === "boolean" ? b.regraEntradaAtiva : null}, "regraEntradaAtiva"),
        "regraEntradaContatoId" = COALESCE(${b.regraEntradaContatoId ?? null}, "regraEntradaContatoId"),
        "regraEntradaCategoriaId" = COALESCE(${b.regraEntradaCategoriaId ?? null}, "regraEntradaCategoriaId"),
        "regraEntradaCentroCustoId" = COALESCE(${b.regraEntradaCentroCustoId ?? null}, "regraEntradaCentroCustoId"),
        "updatedAt" = NOW()
      WHERE id = ${b.id}
      RETURNING *
    `;
    if (!row) return NextResponse.json({ error: "Conta bancária não encontrada" }, { status: 404 });
    return NextResponse.json(row);
  } catch (error: any) {
    console.error("[PUT /api/financeiro/contas-bancarias]", error);
    return NextResponse.json({ error: error?.message || "Erro ao atualizar conta bancária" }, { status: 500 });
  } finally {
    await sql.end();
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Apenas administradores podem excluir registros." }, { status: 403 });
  }
  if (!process.env.DATABASE_URL) return NextResponse.json({ sucesso: true });
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
    await sql`UPDATE "ContaBancaria" SET ativa = false, "updatedAt" = NOW() WHERE id = ${id}`;
    return NextResponse.json({ sucesso: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Erro ao excluir" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
