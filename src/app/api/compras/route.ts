import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/financeiro-db";
import { ensureComprasTables, carregarItensComEstatisticas } from "@/lib/compras-db";

export const dynamic = "force-dynamic";

// GET /api/compras — tudo que a tela /compras precisa: itens (com giro), envios recebidos
// (com os itens de cada um) e o token do link público.
export async function GET() {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Variável DATABASE_URL não configurada." }, { status: 500 });
  const sql = getDb();
  try {
    await ensureComprasTables(sql);
    const itens = await carregarItensComEstatisticas(sql, { incluirInativos: true, incluirNaoAprovados: true });

    const checklists = await sql`
      SELECT id, "preenchidoPor", observacao,
        to_char("createdAt" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI') AS "criadoEm"
      FROM "CompraChecklist" ORDER BY "createdAt" DESC LIMIT 40
    `;
    const ids = checklists.map((c: any) => c.id);
    const pedidoItens = ids.length
      ? await sql`
          SELECT p.id, p."checklistId", p."itemId", p.quantidade, p.observacao, p.status, p."dataCompra",
                 p."quantidadeComprada", p.valor, p."lancamentoId",
                 i.setor, i.nome, i.tipo, i.aprovado
          FROM "CompraPedidoItem" p JOIN "CompraItem" i ON i.id = p."itemId"
          WHERE p."checklistId" IN ${sql(ids)}
          ORDER BY i.setor ASC, i.ordem ASC, i.nome ASC
        `
      : [];

    const [cfg] = await sql`SELECT token FROM "CompraConfig" WHERE id = 'default'`;

    return NextResponse.json({
      itens,
      checklists: checklists.map((c: any) => ({ ...c, itens: pedidoItens.filter((p: any) => p.checklistId === c.id) })),
      token: cfg?.token ?? null,
    });
  } catch (error: any) {
    console.error("[GET /api/compras]", error);
    return NextResponse.json({ error: error?.message || "Erro ao carregar compras" }, { status: 500 });
  } finally {
    await sql.end();
  }
}

// POST /api/compras — cadastra um item novo { setor, nome, tipo? }
export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Variável DATABASE_URL não configurada." }, { status: 500 });
  const sql = getDb();
  try {
    await ensureComprasTables(sql);
    const b = await request.json();
    const setor = String(b.setor ?? "").trim().slice(0, 40);
    const nome = String(b.nome ?? "").trim().slice(0, 80);
    const tipo = b.tipo === "consumo" ? "consumo" : "revenda";
    if (!setor || !nome) return NextResponse.json({ error: "Setor e nome são obrigatórios." }, { status: 400 });

    const [{ proxima }] = await sql`SELECT COALESCE(MAX(ordem), 0) + 1 AS proxima FROM "CompraItem" WHERE ordem < 9999`;
    const [row] = await sql`
      INSERT INTO "CompraItem" (setor, nome, tipo, ordem) VALUES (${setor}, ${nome}, ${tipo}, ${proxima}) RETURNING *
    `;
    return NextResponse.json(row);
  } catch (error: any) {
    console.error("[POST /api/compras]", error);
    return NextResponse.json({ error: error?.message || "Erro ao cadastrar item" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
