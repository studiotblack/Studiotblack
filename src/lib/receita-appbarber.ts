import type { Sql } from "@/lib/financeiro-db";
import { isProduto } from "@/lib/performance-data";

// Regras de negócio confirmadas (outubro/2026) que definem o que do AppBarber entra no DRE
// além do que cai no Sicoob — NÃO misturar os dois:
//  • PRODUTO (qualquer forma de pagamento) é liquidado em OUTRA conta, nunca passa pelo Sicoob.
//    O banco só recebe serviço. Então produto é receita à parte ("Vendas Produtos"), somada —
//    antes o DRE fingia que o produto estava dentro dos depósitos do banco e o "movia" de
//    Serviços pra Produtos, o que subestimava a receita total.
//  • DINHEIRO de serviço também nunca passa pelo banco: entra como receita de "Venda de
//    Serviços" direto do AppBarber. (Dinheiro de produto já está contado no item acima.)
// Linhas antigas com pagamento NULO (antes do fix que passou a ler essa coluna, setembro/2026)
// não dá pra saber se eram dinheiro — contam como não-dinheiro (assumem o banco).
export const CODIGO_VENDA_SERVICOS = "1.1.1.01.001";
export const CODIGO_VENDA_PRODUTOS = "1.1.1.01.002";

export interface VendaAppBarber {
  dia: number;
  mes: number;
  ano: number;
  valor: number;
  produto: boolean;
  dinheiro: boolean;
}

// `filtroMesAno` é um LIKE sobre "mesAno" (ex: "%/2026" pro ano todo, ou "09/2026" pra um mês).
export async function carregarVendasAppBarber(sql: Sql, filtroMesAno: string): Promise<VendaAppBarber[]> {
  const rows = await sql`
    SELECT data, item, "valorBruto", pagamento FROM "DesempenhoProfissionalDB" WHERE "mesAno" LIKE ${filtroMesAno}
  `;
  const vendas: VendaAppBarber[] = [];
  for (const r of rows as any[]) {
    const [dia, mes, ano] = String(r.data).split(" ")[0].split("/").map(Number);
    if (!dia || !mes || !ano) continue;
    vendas.push({ dia, mes, ano, valor: Number(r.valorBruto), produto: isProduto(r.item), dinheiro: r.pagamento === "Dinheiro" });
  }
  return vendas;
}

// Parte do AppBarber que entra no DRE como receita FORA do Sicoob
export const entraNaReceitaDoDre = (v: VendaAppBarber) => v.produto || v.dinheiro;
export const codigoReceita = (v: VendaAppBarber) => (v.produto ? CODIGO_VENDA_PRODUTOS : CODIGO_VENDA_SERVICOS);
