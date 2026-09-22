import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";

export const dynamic = "force-dynamic";

// Comparar dia a dia por igualdade estrita não funciona: o cartão leva de 1 a alguns dias
// úteis pra compensar (a venda de hoje pode só virar dinheiro no banco daqui a 2-3 dias, ou
// vir num lote de "antecipação" que mistura vários dias) — isso sozinho já cria diferença
// diária de milhares de reais TODO santo dia, sem ser erro nenhum. Confirmado com dados reais
// de setembro/2026: com tolerância apertada, 19 de 19 dias "davam erro". Por isso o status por
// dia virou só um destaque visual pra diferença grande de verdade (não uma alegação de bug),
// e o veredito real ("bate"/"revisar") é do MÊS acumulado, que absorve o atraso normal.
const DESTAQUE_DIFERENCA_DIA = 5000;
const TOLERANCIA_RELATIVA_MES = 0.15;

// GET /api/financeiro/conciliacao-faturamento?mesAno=09/2026
// Cruza o faturamento bruto do AppBarber (DesempenhoProfissionalDB) com o que efetivamente
// caiu no banco como "venda" (LancamentoFinanceiro pago, na(s) categoria(s) que a regra de
// entrada automática do Sicoob usa) — dia a dia, pra pegar rápido qualquer entrada bancária
// mal-categorizada (ex: um aporte/transferência que a regra confundiu com venda — já
// aconteceu de verdade com um PIX de R$20.500 em setembro/2026) ou venda do AppBarber que
// ainda não caiu no banco (atraso de repasse do cartão, por exemplo).
export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ dias: [], totalAppBarber: 0, totalBanco: 0, totalDinheiro: 0, diasParaRevisar: 0, temPagamentoDesconhecido: false });
  }
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const { searchParams } = new URL(request.url);
    const mesAno = searchParams.get("mesAno");
    if (!mesAno || !/^\d{2}\/\d{4}$/.test(mesAno)) {
      return NextResponse.json({ error: "Parâmetro mesAno inválido (esperado MM/YYYY)" }, { status: 400 });
    }
    const [mes, ano] = mesAno.split("/");
    const prefixoDataCompetencia = `${ano}-${mes}`;

    // 1. Categoria(s) que a regra de entrada automática do Sicoob usa — só essas entram no
    // lado "Banco" da comparação (é o mesmo rótulo que a regra aplica em toda entrada sem
    // match, então é o que representa "venda" pro banco).
    const contas = await sql`
      SELECT "regraEntradaCategoriaId" FROM "ContaBancaria"
      WHERE ativa = true AND "regraEntradaAtiva" = true AND "regraEntradaCategoriaId" IS NOT NULL
    `;
    const categoriaIds = [...new Set(contas.map((c) => c.regraEntradaCategoriaId as string))];

    const bancoPorDia = new Map<number, number>();
    if (categoriaIds.length > 0) {
      const rows = await sql`
        SELECT a."dataCompetencia" as data, SUM(acat.valor) as total
        FROM "LancamentoFinanceiro" a
        JOIN "LancamentoFinanceiroCategoria" acat ON acat."lancamentoId" = a.id
        WHERE a.tipo = 'receber'
          AND a."dataCompetencia" LIKE ${prefixoDataCompetencia + "%"}
          AND acat."categoriaId" = ANY(${categoriaIds})
          AND a."valorPago" > 0
        GROUP BY a."dataCompetencia"
      `;
      for (const r of rows) {
        const dia = Number(String(r.data).split("-")[2]);
        if (dia) bancoPorDia.set(dia, (bancoPorDia.get(dia) || 0) + Number(r.total));
      }
    }

    // 2. AppBarber por dia — exclui vendas em "Dinheiro" (nunca caem no banco, comparar
    // contra elas só geraria diferença falsa todo dia). Linhas com pagamento ainda NULO (de
    // antes do fix que passou a capturar essa coluna) entram por padrão, já que não dá pra
    // saber se eram dinheiro ou não — sinalizado na resposta pra não confundir com "bateu"
    // de verdade.
    const vendas = await sql`
      SELECT data, "valorBruto", pagamento
      FROM "DesempenhoProfissionalDB"
      WHERE "mesAno" = ${mesAno}
    `;
    const appBarberPorDia = new Map<number, number>();
    let totalDinheiro = 0;
    let temPagamentoDesconhecido = false;
    for (const v of vendas) {
      const diaStr = String(v.data).split(" ")[0].split("/")[0];
      const dia = Number(diaStr);
      if (!dia) continue;
      if (v.pagamento === "Dinheiro") {
        totalDinheiro += Number(v.valorBruto);
        continue;
      }
      if (v.pagamento == null) temPagamentoDesconhecido = true;
      appBarberPorDia.set(dia, (appBarberPorDia.get(dia) || 0) + Number(v.valorBruto));
    }

    // 3. Junta os dois por dia — "destaque" é só um realce visual pro dia com diferença bem
    // grande (candidato a olhar primeiro), não uma alegação de erro por si só.
    const todosDias = new Set([...bancoPorDia.keys(), ...appBarberPorDia.keys()]);
    const dias = Array.from(todosDias)
      .sort((a, b) => a - b)
      .map((dia) => {
        const appBarber = appBarberPorDia.get(dia) || 0;
        const banco = bancoPorDia.get(dia) || 0;
        const diferenca = banco - appBarber;
        return {
          dia,
          appBarber: Number(appBarber.toFixed(2)),
          banco: Number(banco.toFixed(2)),
          diferenca: Number(diferenca.toFixed(2)),
          destaque: diferenca > DESTAQUE_DIFERENCA_DIA,
        };
      });

    const totalAppBarber = dias.reduce((acc, d) => acc + d.appBarber, 0);
    const totalBanco = dias.reduce((acc, d) => acc + d.banco, 0);
    const diferencaMes = totalBanco - totalAppBarber;
    // Tolerância relativa (não fixa) porque o "esperado" varia com o tamanho do mês/movimento
    // — parte da diferença é só venda recente ainda não compensada, normal em qualquer ponto
    // do mês antes do fechamento.
    const statusMes: "ok" | "revisar" = totalAppBarber === 0
      ? (totalBanco === 0 ? "ok" : "revisar")
      : Math.abs(diferencaMes) / totalAppBarber <= TOLERANCIA_RELATIVA_MES ? "ok" : "revisar";

    return NextResponse.json({
      mesAno,
      dias,
      totalAppBarber: Number(totalAppBarber.toFixed(2)),
      totalBanco: Number(totalBanco.toFixed(2)),
      totalDinheiro: Number(totalDinheiro.toFixed(2)),
      statusMes,
      temPagamentoDesconhecido,
    });
  } catch (error: any) {
    console.error("[GET /api/financeiro/conciliacao-faturamento]", error);
    return NextResponse.json({ error: error?.message || "Erro ao calcular conciliação de faturamento" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
