import { NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";

export const dynamic = "force-dynamic";

const TOLERANCIA_SOMA = 0.05;

function mesAnoDe(data: string): string {
  const d = new Date(data + "T12:00:00");
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// POST /api/financeiro/cartao-credito/sugestoes/[transacaoId]/confirmar
// Confirma manualmente que a fatura do cartão (uma saída bancária) corresponde à soma das
// compras acumuladas do mês — recalcula a mesma sugestão do GET /sugestoes no servidor (não
// confia em nenhuma lista vinda do cliente) e, se ainda bater, cria UM lançamento já baixado,
// dividido por categoria conforme a categoria sugerida de cada compra original (ou uma
// categoria genérica "Fatura Cartão de Crédito" pras que não tinham nenhuma reconhecida).
export async function POST(_request: Request, ctx: { params: Promise<{ transacaoId: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Variável DATABASE_URL não configurada." }, { status: 500 });
  }
  const { transacaoId } = await ctx.params;
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);

    const [transacao] = await sql`SELECT * FROM "TransacaoBancariaImportada" WHERE id = ${transacaoId}`;
    if (!transacao) return NextResponse.json({ error: "Transação não encontrada" }, { status: 404 });
    if (transacao.status !== "pendente") {
      return NextResponse.json({ error: "Esta transação já foi conciliada ou ignorada" }, { status: 400 });
    }

    const mesRef = mesAnoDe(transacao.data);
    const candidatas = await sql`
      SELECT c.*, comp."categoriaSugeridaId"
      FROM "CompraCartaoCredito" c
      LEFT JOIN "WhatsappComprovante" comp ON comp.id = c."whatsappComprovanteId"
      WHERE c.status = 'pendente' AND c."mesReferencia" = ${mesRef}
        AND (c."contaBancariaId" IS NULL OR c."contaBancariaId" = ${transacao.contaBancariaId})
    `;
    if (candidatas.length === 0) {
      return NextResponse.json({ error: "Nenhuma compra de cartão pendente bate com esse mês/conta." }, { status: 400 });
    }
    const soma = candidatas.reduce((acc, c: any) => acc + Number(c.valorParcela), 0);
    if (Math.abs(soma - Number(transacao.valor)) > TOLERANCIA_SOMA) {
      return NextResponse.json({ error: `A soma das compras pendentes (${soma.toFixed(2)}) não bate com o valor da transação (${transacao.valor}).` }, { status: 400 });
    }

    const [contatoFallback] = await sql`SELECT id FROM "Contato" WHERE nome = 'Fornecedor Diversos (WhatsApp)' LIMIT 1`;
    if (!contatoFallback) {
      return NextResponse.json({ error: `Contato "Fornecedor Diversos (WhatsApp)" não encontrado — cadastre-o pra poder confirmar faturas de cartão.` }, { status: 400 });
    }

    let [categoriaFallback] = await sql`SELECT id FROM "CategoriaFinanceira" WHERE nome = 'Fatura Cartão de Crédito' LIMIT 1`;
    if (!categoriaFallback) {
      [categoriaFallback] = await sql`
        INSERT INTO "CategoriaFinanceira" (grupo, nome, tipo)
        VALUES ('despesas operacionais e outras receitas', 'Fatura Cartão de Crédito', 'saida')
        RETURNING id
      `;
    }

    // Agrupa as compras por categoria sugerida (a do dicionário de palavras-chave do
    // comprovante original) — as sem nenhuma sugestão caem na categoria genérica.
    const somaPorCategoria = new Map<string, number>();
    for (const c of candidatas as any[]) {
      const catId = c.categoriaSugeridaId || categoriaFallback.id;
      somaPorCategoria.set(catId, (somaPorCategoria.get(catId) || 0) + Number(c.valorParcela));
    }

    const resultado = await sql.begin(async (sql) => {
      const [novoLancamento] = await sql`
        INSERT INTO "LancamentoFinanceiro"
          (tipo, "contatoId", valor, "valorPago", "dataVencimento", "dataCompetencia", descricao, "contaBancariaId")
        VALUES
          ('pagar', ${contatoFallback.id}, ${transacao.valor}, ${transacao.valor}, ${transacao.data}, ${transacao.data}, ${`Fatura cartão de crédito — ${candidatas.length} compra(s)`}, ${transacao.contaBancariaId})
        RETURNING *
      `;
      for (const [catId, valor] of somaPorCategoria) {
        await sql`
          INSERT INTO "LancamentoFinanceiroCategoria" ("lancamentoId", "categoriaId", valor)
          VALUES (${novoLancamento.id}, ${catId}, ${valor})
        `;
      }
      await sql`
        INSERT INTO "Baixa" ("lancamentoId", valor, data, "contaBancariaId", observacao)
        VALUES (${novoLancamento.id}, ${transacao.valor}, ${transacao.data}, ${transacao.contaBancariaId}, ${"Fatura do cartão confirmada manualmente contra as compras acumuladas"})
      `;
      for (const c of candidatas as any[]) {
        await sql`UPDATE "CompraCartaoCredito" SET status = 'baixado', "lancamentoId" = ${novoLancamento.id} WHERE id = ${c.id}`;
      }
      const [transacaoAtualizada] = await sql`
        UPDATE "TransacaoBancariaImportada" SET status = 'conciliado', "lancamentoId" = ${novoLancamento.id} WHERE id = ${transacaoId} RETURNING *
      `;
      return { lancamento: novoLancamento, transacao: transacaoAtualizada };
    });

    return NextResponse.json({ ok: true, ...resultado, compras: candidatas.length, soma });
  } catch (error: any) {
    console.error("[POST /api/financeiro/cartao-credito/sugestoes/[transacaoId]/confirmar]", error);
    return NextResponse.json({ error: error?.message || "Erro ao confirmar fatura do cartão" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
