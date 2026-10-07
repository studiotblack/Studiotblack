import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";
import {
  carregarVendasAppBarber, entraNaReceitaDoDre, codigoReceita, CODIGO_VENDA_SERVICOS, CODIGO_VENDA_PRODUTOS,
} from "@/lib/receita-appbarber";

export const dynamic = "force-dynamic";

// GET /api/financeiro/dre/detalhe?codigo=1.1.1.01.001&mes=8&ano=2026
// Drill-down de uma linha do DRE: busca os lançamentos do NOSSO ledger (Contas a
// Pagar/Receber) cuja categoria tem o mesmo código contábil da linha do DRE, no mês
// de competência clicado. Só funciona pra lançamentos que passaram pelo sistema
// (Sicoob sincronizado ou cadastrados manualmente) — o "Realizado" importado do
// Excel é um total já fechado pelo contador, sem o detalhe transação a transação.
export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ lancamentos: [], totalNoSistema: 0 });
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const { searchParams } = new URL(request.url);
    const codigo = searchParams.get("codigo");
    const mes = searchParams.get("mes");
    const ano = searchParams.get("ano");

    if (!codigo || !mes || !ano) {
      return NextResponse.json({ error: "codigo, mes e ano são obrigatórios" }, { status: 400 });
    }

    const prefixoCompetencia = `${ano}-${mes.padStart(2, "0")}`;

    const rows = await sql`
      SELECT
        a.id, a.tipo, a.valor, "valorPago", "dataCompetencia", "dataVencimento", a.descricao,
        c.nome AS "contatoNome",
        cat.nome AS "categoriaNome",
        cb.nome AS "contaBancariaNome"
      FROM "LancamentoFinanceiro" a
      JOIN "LancamentoFinanceiroCategoria" ac ON ac."lancamentoId" = a.id
      JOIN "CategoriaFinanceira" cat ON cat.id = ac."categoriaId"
      JOIN "Contato" c ON c.id = a."contatoId"
      LEFT JOIN "ContaBancaria" cb ON cb.id = a."contaBancariaId"
      WHERE cat.codigo = ${codigo}
        AND a."dataCompetencia" LIKE ${prefixoCompetencia + "%"}
      ORDER BY a."dataCompetencia" ASC
    `;

    const lancamentos: any[] = [...rows];

    // Receita que o DRE soma direto do AppBarber (produto + dinheiro de serviço) não existe como
    // lançamento — mostra por dia, com rótulo próprio, pra o drill-down fechar com o valor do DRE
    // e deixar claro que NÃO passou pelo Sicoob.
    if (codigo === CODIGO_VENDA_SERVICOS || codigo === CODIGO_VENDA_PRODUTOS) {
      const vendas = await carregarVendasAppBarber(sql, `${mes.padStart(2, "0")}/${ano}`);
      const porDia = new Map<string, number>();
      for (const v of vendas) {
        if (!entraNaReceitaDoDre(v) || codigoReceita(v) !== codigo) continue;
        const dia = `${v.ano}-${String(v.mes).padStart(2, "0")}-${String(v.dia).padStart(2, "0")}`;
        porDia.set(dia, (porDia.get(dia) ?? 0) + v.valor);
      }
      const ehProduto = codigo === CODIGO_VENDA_PRODUTOS;
      for (const [dia, valor] of [...porDia.entries()].sort()) {
        lancamentos.push({
          id: `appbarber-${codigo}-${dia}`,
          tipo: "receber",
          valor: Number(valor.toFixed(2)),
          valorPago: Number(valor.toFixed(2)),
          dataCompetencia: dia,
          dataVencimento: dia,
          descricao: ehProduto ? "AppBarber — produtos vendidos no dia" : "AppBarber — serviços pagos em dinheiro no dia",
          contatoNome: "AppBarber",
          categoriaNome: ehProduto ? "Vendas Produtos" : "Venda de Serviços",
          contaBancariaNome: ehProduto ? "Conta de produtos (fora do Sicoob)" : "Dinheiro (não passa pelo banco)",
        });
      }
    }

    const totalNoSistema = lancamentos.reduce((acc: number, r: any) => acc + (r.tipo === "receber" ? r.valor : -r.valor), 0);

    return NextResponse.json({ lancamentos, totalNoSistema });
  } catch (error: any) {
    console.error("[GET /api/financeiro/dre/detalhe]", error);
    return NextResponse.json({ error: error?.message || "Erro ao buscar detalhe do DRE" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
