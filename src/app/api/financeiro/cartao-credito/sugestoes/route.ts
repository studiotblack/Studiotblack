import { NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";

export const dynamic = "force-dynamic";

// Compras no cartão acumuladas (`CompraCartaoCredito`, uma linha por parcela) não têm como
// bater 1:1 com uma transação bancária — só a fatura inteira aparece no extrato, somando
// várias. Tolerância pequena pra cobrir arredondamento de centavos ao somar parcelas.
const TOLERANCIA_SOMA = 0.05;

function mesAnoDe(data: string): string {
  const d = new Date(data + "T12:00:00");
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// GET /api/financeiro/cartao-credito/sugestoes
// Retorna as compras de cartão ainda pendentes (a "caixinha") e, pra cada saída bancária
// ainda sem conciliar, sugere quais compras pendentes desse mês somam o valor da fatura —
// pra revisão e confirmação manual (nunca dá baixa sozinho).
export async function GET() {
  if (!process.env.DATABASE_URL) return NextResponse.json({ pendentes: [], sugestoes: [] });
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);

    const pendentes = await sql`
      SELECT c.*, conta.nome AS "contaNome", cat.nome AS "categoriaSugeridaNome"
      FROM "CompraCartaoCredito" c
      LEFT JOIN "ContaBancaria" conta ON conta.id = c."contaBancariaId"
      LEFT JOIN "WhatsappComprovante" comp ON comp.id = c."whatsappComprovanteId"
      LEFT JOIN "CategoriaFinanceira" cat ON cat.id = comp."categoriaSugeridaId"
      WHERE c.status = 'pendente'
      ORDER BY c."mesReferencia" ASC, c."createdAt" ASC
    `;

    const transacoesPendentes = await sql`
      SELECT * FROM "TransacaoBancariaImportada" WHERE tipo = 'saida' AND status = 'pendente'
    `;

    const sugestoes: any[] = [];
    for (const tx of transacoesPendentes) {
      const mesRef = mesAnoDe(tx.data);
      const candidatas = (pendentes as any[]).filter(
        (c) => c.mesReferencia === mesRef && (c.contaBancariaId === null || c.contaBancariaId === tx.contaBancariaId)
      );
      if (candidatas.length === 0) continue;
      const soma = candidatas.reduce((acc, c) => acc + Number(c.valorParcela), 0);
      if (Math.abs(soma - Number(tx.valor)) <= TOLERANCIA_SOMA) {
        sugestoes.push({
          transacaoId: tx.id,
          dataTransacao: tx.data,
          valorTransacao: tx.valor,
          contaBancariaId: tx.contaBancariaId,
          somaCompras: soma,
          compras: candidatas,
        });
      }
    }

    return NextResponse.json({ pendentes, sugestoes });
  } catch (error: any) {
    console.error("[GET /api/financeiro/cartao-credito/sugestoes]", error);
    return NextResponse.json({ error: error?.message || "Erro ao buscar sugestões de fatura" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
