import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";
import { dataDaParcela } from "@/lib/financeiro-recorrencia";

export const dynamic = "force-dynamic";

// Quantas ocorrências futuras manter em aberto de uma vez pra recorrência indefinida (ex:
// aluguel) — pra dar pra ver/planejar alguns meses à frente, não só o próximo mês, sem
// gerar uma lista infinita. O resto nasce sozinho conforme cada uma vai sendo paga, em
// agendamentos/[id]/baixas/route.ts.
const JANELA_OCORRENCIAS_FUTURAS = 3;

// POST /api/financeiro/series
// Cria uma recorrência indefinida (parcelaTotal nulo, ex: aluguel) ou um parcelamento
// fechado (parcelaTotal definido, ex: compra em 3x) como uma série de verdade — diferente
// do "recorrencia" antigo (string solta no lançamento), aqui existe um registro central
// (LancamentoSerie) que permite editar/cancelar todas as ocorrências futuras de uma vez.
export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Variável DATABASE_URL não configurada." }, { status: 500 });
  }
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const b = await request.json();

    if (!b.tipo || !b.contatoId || !b.valorParcela || b.valorParcela <= 0 || !b.intervalo || !b.dataInicio || !b.descricao) {
      return NextResponse.json({ error: "tipo, contatoId, valorParcela, intervalo, dataInicio e descricao são obrigatórios" }, { status: 400 });
    }
    if (b.intervalo !== "semanal" && b.intervalo !== "mensal") {
      return NextResponse.json({ error: "intervalo precisa ser 'semanal' ou 'mensal'" }, { status: 400 });
    }
    if (b.parcelaTotal !== undefined && b.parcelaTotal !== null && b.parcelaTotal < 2) {
      return NextResponse.json({ error: "parcelaTotal precisa ser pelo menos 2 — 1 parcela não é uma série, é só um lançamento avulso" }, { status: 400 });
    }

    const resultado = await sql.begin(async (sql) => {
      const [serie] = await sql`
        INSERT INTO "LancamentoSerie"
          (tipo, "contatoId", descricao, "valorParcela", intervalo, "parcelaTotal", "contaBancariaId", "categoriaId", "centroCustoId")
        VALUES (
          ${b.tipo}, ${b.contatoId}, ${b.descricao}, ${b.valorParcela}, ${b.intervalo},
          ${b.parcelaTotal ?? null}, ${b.contaBancariaId ?? null}, ${b.categoriaId ?? null}, ${b.centroCustoId ?? null}
        )
        RETURNING *
      `;

      // Parcelamento fechado: gera as N ocorrências de uma vez, todas visíveis já na
      // criação. Recorrência indefinida: só a janela inicial — o resto nasce sozinho.
      const quantidadeGerar = b.parcelaTotal ? b.parcelaTotal : JANELA_OCORRENCIAS_FUTURAS;
      const ocorrencias = [];
      for (let n = 1; n <= quantidadeGerar; n++) {
        const data = dataDaParcela(b.dataInicio, b.intervalo, n);
        const [lanc] = await sql`
          INSERT INTO "LancamentoFinanceiro"
            (tipo, "contatoId", valor, "dataVencimento", "dataCompetencia", descricao, referencia, detalhamento, "contaBancariaId", "serieId", "parcelaNumero")
          VALUES (
            ${b.tipo}, ${b.contatoId}, ${b.valorParcela}, ${data}, ${data},
            ${b.descricao}, ${b.referencia ?? null}, ${b.detalhamento ?? null},
            ${b.contaBancariaId ?? null}, ${serie.id}, ${n}
          )
          RETURNING *
        `;
        if (b.categoriaId) {
          await sql`INSERT INTO "LancamentoFinanceiroCategoria" ("lancamentoId", "categoriaId", valor) VALUES (${lanc.id}, ${b.categoriaId}, ${b.valorParcela})`;
        }
        if (b.centroCustoId) {
          await sql`INSERT INTO "LancamentoFinanceiroCentroCusto" ("lancamentoId", "centroCustoId", valor) VALUES (${lanc.id}, ${b.centroCustoId}, ${b.valorParcela})`;
        }
        ocorrencias.push(lanc);
      }

      return { serie, ocorrencias };
    });

    return NextResponse.json(resultado);
  } catch (error: any) {
    console.error("[POST /api/financeiro/series]", error);
    return NextResponse.json({ error: error?.message || "Erro ao criar série" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
