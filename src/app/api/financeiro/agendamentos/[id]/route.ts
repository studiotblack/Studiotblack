import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";
import { isAdminRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

// PATCH /api/financeiro/agendamentos/[id] — edita os campos e substitui o rateio simples
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Variável DATABASE_URL não configurada." }, { status: 500 });
  }
  const { id } = await ctx.params;
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const b = await request.json();

    const agendamento = await sql.begin(async (sql) => {
      const [row] = await sql`
        UPDATE "LancamentoFinanceiro" SET
          tipo = ${b.tipo},
          "contatoId" = ${b.contatoId},
          valor = ${b.valor},
          "dataVencimento" = ${b.dataVencimento || null},
          "dataCompetencia" = ${b.dataCompetencia},
          "dataPrevisao" = ${b.dataPrevisao ?? null},
          descricao = ${b.descricao},
          referencia = ${b.referencia ?? null},
          detalhamento = ${b.detalhamento ?? null},
          "contaBancariaId" = ${b.contaBancariaId ?? null},
          reembolsavel = ${b.reembolsavel ?? false},
          "updatedAt" = NOW()
        WHERE id = ${id}
        RETURNING *
      `;

      if (!row) throw new Error("Agendamento não encontrado");

      await sql`DELETE FROM "LancamentoFinanceiroCategoria" WHERE "lancamentoId" = ${id}`;
      await sql`DELETE FROM "LancamentoFinanceiroCentroCusto" WHERE "lancamentoId" = ${id}`;

      if (b.categoriaId) {
        await sql`INSERT INTO "LancamentoFinanceiroCategoria" ("lancamentoId", "categoriaId", valor) VALUES (${id}, ${b.categoriaId}, ${b.valor})`;
      }
      if (b.centroCustoId) {
        await sql`INSERT INTO "LancamentoFinanceiroCentroCusto" ("lancamentoId", "centroCustoId", valor) VALUES (${id}, ${b.centroCustoId}, ${b.valor})`;
      }

      return row;
    });

    return NextResponse.json(agendamento);
  } catch (error: any) {
    console.error("[PATCH /api/financeiro/agendamentos/[id]]", error);
    return NextResponse.json({ error: error?.message || "Erro ao editar agendamento" }, { status: 500 });
  } finally {
    await sql.end();
  }
}

// DELETE /api/financeiro/agendamentos/[id] — só permite cancelar um agendamento sem nenhuma baixa registrada
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Apenas administradores podem excluir registros." }, { status: 403 });
  }
  if (!process.env.DATABASE_URL) return NextResponse.json({ sucesso: true });
  const { id } = await ctx.params;
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM "Baixa" WHERE "lancamentoId" = ${id}`;
    if (count > 0) {
      return NextResponse.json({ error: "Este agendamento já tem baixa registrada e não pode ser excluído — só cancelado manualmente após estorno." }, { status: 400 });
    }
    await sql`DELETE FROM "LancamentoFinanceiro" WHERE id = ${id}`;
    return NextResponse.json({ sucesso: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Erro ao excluir" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
