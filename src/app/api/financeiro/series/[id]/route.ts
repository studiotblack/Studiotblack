import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";

export const dynamic = "force-dynamic";

// PATCH /api/financeiro/series/[id]
// Atualiza a série e propaga o valor/categoria/centro de custo/conta/descrição pra TODAS
// as ocorrências ainda não pagas (valorPago = 0) — resolve o "mudei o valor do aluguel,
// preciso editar todo mês". Ocorrências já quitadas nunca são tocadas (o histórico do que
// foi pago de verdade não muda retroativamente).
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Variável DATABASE_URL não configurada." }, { status: 500 });
  }
  const { id } = await ctx.params;
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const b = await request.json();

    const resultado = await sql.begin(async (sql) => {
      const [serie] = await sql`
        UPDATE "LancamentoSerie" SET
          "valorParcela" = COALESCE(${b.valorParcela ?? null}, "valorParcela"),
          "categoriaId" = COALESCE(${b.categoriaId ?? null}, "categoriaId"),
          "centroCustoId" = COALESCE(${b.centroCustoId ?? null}, "centroCustoId"),
          "contaBancariaId" = COALESCE(${b.contaBancariaId ?? null}, "contaBancariaId"),
          descricao = COALESCE(${b.descricao ?? null}, descricao),
          ativa = COALESCE(${typeof b.ativa === "boolean" ? b.ativa : null}, ativa),
          "updatedAt" = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
      if (!serie) throw new Error("Série não encontrada");

      const naoPagos = await sql`SELECT id FROM "LancamentoFinanceiro" WHERE "serieId" = ${id} AND "valorPago" = 0`;
      for (const l of naoPagos) {
        await sql`
          UPDATE "LancamentoFinanceiro" SET
            valor = ${serie.valorParcela}, descricao = ${serie.descricao},
            "contaBancariaId" = ${serie.contaBancariaId}, "updatedAt" = NOW()
          WHERE id = ${l.id}
        `;
        await sql`DELETE FROM "LancamentoFinanceiroCategoria" WHERE "lancamentoId" = ${l.id}`;
        if (serie.categoriaId) {
          await sql`INSERT INTO "LancamentoFinanceiroCategoria" ("lancamentoId", "categoriaId", valor) VALUES (${l.id}, ${serie.categoriaId}, ${serie.valorParcela})`;
        }
        await sql`DELETE FROM "LancamentoFinanceiroCentroCusto" WHERE "lancamentoId" = ${l.id}`;
        if (serie.centroCustoId) {
          await sql`INSERT INTO "LancamentoFinanceiroCentroCusto" ("lancamentoId", "centroCustoId", valor) VALUES (${l.id}, ${serie.centroCustoId}, ${serie.valorParcela})`;
        }
      }

      return { serie, ocorrenciasAtualizadas: naoPagos.length };
    });

    return NextResponse.json(resultado);
  } catch (error: any) {
    console.error("[PATCH /api/financeiro/series/[id]]", error);
    return NextResponse.json({ error: error?.message || "Erro ao atualizar série" }, { status: 500 });
  } finally {
    await sql.end();
  }
}

// DELETE /api/financeiro/series/[id]?excluirFuturas=true
// Cancela a série (para de gerar novas ocorrências). Com "excluirFuturas=true", também
// apaga as ocorrências que ainda não foram pagas (mesma regra de sempre: só apaga o que
// não tem baixa — uma ocorrência já paga nunca é removida, faz parte do histórico real).
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Variável DATABASE_URL não configurada." }, { status: 500 });
  }
  const { id } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const excluirFuturas = searchParams.get("excluirFuturas") === "true";
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);

    const [serie] = await sql`UPDATE "LancamentoSerie" SET ativa = false, "updatedAt" = NOW() WHERE id = ${id} RETURNING *`;
    if (!serie) return NextResponse.json({ error: "Série não encontrada" }, { status: 404 });

    let removidos = 0;
    if (excluirFuturas) {
      const apagados = await sql`DELETE FROM "LancamentoFinanceiro" WHERE "serieId" = ${id} AND "valorPago" = 0 RETURNING id`;
      removidos = apagados.length;
    }

    return NextResponse.json({ ok: true, serie, removidos });
  } catch (error: any) {
    console.error("[DELETE /api/financeiro/series/[id]]", error);
    return NextResponse.json({ error: error?.message || "Erro ao cancelar série" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
