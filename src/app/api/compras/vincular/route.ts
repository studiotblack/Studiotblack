import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";
import { ensureComprasTables } from "@/lib/compras-db";

export const dynamic = "force-dynamic";

// Categorias do plano de contas usadas no rateio (por código, estáveis):
const CATEGORIA_POR_TIPO: Record<string, string> = {
  revenda: "1.1.2.01.001", // Compra de Mercadorias para Revenda
  consumo: "1.1.2.02.011", // Uso e Consumo
};

const hojeSP = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

// POST /api/compras/vincular — transforma itens JÁ COMPRADOS (e ainda sem vínculo) em UM
// lançamento "a pagar" no Contas a Pagar, rateado entre Revenda e Uso e Consumo pelo valor de
// cada item. É o botão "Vincular ao Contas a Pagar": a decisão é sempre do dono (nada aqui
// roda sozinho). Body: { ids, contatoId, dataVencimento?, valor? (sobrescreve a soma), descricao? }
export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Variável DATABASE_URL não configurada." }, { status: 500 });
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    await ensureComprasTables(sql);
    const b = await request.json();
    const ids: string[] = Array.isArray(b.ids) ? b.ids.map(String) : [];
    if (ids.length === 0 || !b.contatoId) {
      return NextResponse.json({ error: "Selecione os itens e o fornecedor." }, { status: 400 });
    }

    const resultado = await sql.begin(async (tx) => {
      // FOR UPDATE: dois cliques/abas não vinculam o mesmo item duas vezes (mesmo cuidado do
      // TOCTOU da conciliação).
      const itens = await tx`
        SELECT p.id, p.valor, p."dataCompra", i.tipo, i.nome
        FROM "CompraPedidoItem" p JOIN "CompraItem" i ON i.id = p."itemId"
        WHERE p.id IN ${tx(ids)} AND p.status = 'comprado' AND p."lancamentoId" IS NULL
        FOR UPDATE OF p
      `;
      if (itens.length === 0) throw new Error("Nenhum item comprado e ainda sem vínculo entre os selecionados.");

      const somaPorTipo: Record<string, number> = { revenda: 0, consumo: 0 };
      for (const it of itens) somaPorTipo[it.tipo === "consumo" ? "consumo" : "revenda"] += Number(it.valor ?? 0);
      const somaItens = somaPorTipo.revenda + somaPorTipo.consumo;

      const total = b.valor !== undefined && b.valor !== null && b.valor !== "" ? Number(b.valor) : somaItens;
      if (!Number.isFinite(total) || total <= 0) {
        throw new Error("Informe o valor da compra (nenhum item tem valor lançado).");
      }

      // Rateio proporcional ao valor de cada tipo; sem valores nos itens, tudo vai pro tipo
      // que tem mais itens.
      let partes: { tipo: string; valor: number }[];
      if (somaItens > 0) {
        partes = (["revenda", "consumo"] as const)
          .filter((t) => somaPorTipo[t] > 0)
          .map((t) => ({ tipo: t, valor: Number(((total * somaPorTipo[t]) / somaItens).toFixed(2)) }));
      } else {
        const nConsumo = itens.filter((i: any) => i.tipo === "consumo").length;
        partes = [{ tipo: nConsumo > itens.length / 2 ? "consumo" : "revenda", valor: total }];
      }
      // ajuste de centavos: a última parte fecha o total
      const somaPartes = partes.reduce((a, p) => a + p.valor, 0);
      partes[partes.length - 1].valor = Number((partes[partes.length - 1].valor + (total - somaPartes)).toFixed(2));

      const hoje = hojeSP();
      const dataVenc = /^\d{4}-\d{2}-\d{2}$/.test(String(b.dataVencimento ?? "")) ? String(b.dataVencimento) : hoje;
      const dataCompetencia = itens.map((i: any) => i.dataCompra).filter(Boolean).sort()[0] ?? hoje;
      const [d, m] = [dataCompetencia.slice(8, 10), dataCompetencia.slice(5, 7)];
      const descricao = String(b.descricao ?? "").trim().slice(0, 140) || `Compras do studio — checklist ${d}/${m}`;
      const detalhamento = itens.map((i: any) => i.nome).join(", ").slice(0, 900);

      const [lanc] = await tx`
        INSERT INTO "LancamentoFinanceiro" (tipo, "contatoId", valor, "dataVencimento", "dataCompetencia", descricao, detalhamento)
        VALUES ('pagar', ${b.contatoId}, ${total}, ${dataVenc}, ${dataCompetencia}, ${descricao}, ${detalhamento})
        RETURNING id
      `;

      for (const parte of partes) {
        const [cat] = await tx`SELECT id FROM "CategoriaFinanceira" WHERE codigo = ${CATEGORIA_POR_TIPO[parte.tipo]} LIMIT 1`;
        if (cat) {
          await tx`
            INSERT INTO "LancamentoFinanceiroCategoria" ("lancamentoId", "categoriaId", valor)
            VALUES (${lanc.id}, ${cat.id}, ${parte.valor})
          `;
        }
      }

      await tx`UPDATE "CompraPedidoItem" SET "lancamentoId" = ${lanc.id} WHERE id IN ${tx(itens.map((i: any) => i.id))}`;
      return { lancamentoId: lanc.id as string, itens: itens.length, valor: total };
    });

    return NextResponse.json({ ok: true, ...resultado });
  } catch (error: any) {
    console.error("[POST /api/compras/vincular]", error);
    return NextResponse.json({ error: error?.message || "Erro ao vincular ao Contas a Pagar" }, { status: 400 });
  } finally {
    await sql.end();
  }
}
