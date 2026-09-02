import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";
import type { DreLinhaImportada } from "@/lib/dre-data";

export const dynamic = "force-dynamic";

// Mapeia o campo "grupo" da CategoriaFinanceira (herdado do plano de contas do Nibo)
// pro DREGrupo interno — mesma taxonomia de 5 grupos usada em todo o resto do sistema.
const GRUPO_MAP: Record<string, { label: string; sinalDespesa: boolean }> = {
  "receitas operacionais": { label: "RECEITAS OPERACIONAIS", sinalDespesa: false },
  "custos operacionais": { label: "(-) CUSTOS OPERACIONAIS", sinalDespesa: true },
  "despesas operacionais e outras receitas": { label: "(-) DESPESAS OPERACIONAIS", sinalDespesa: true },
  "atividades de investimento": { label: "(-) INVESTIMENTOS", sinalDespesa: true },
  "atividades de financiamento": { label: "(-) FINANCIAMENTO", sinalDespesa: true },
};
const ORDEM_GRUPOS = Object.keys(GRUPO_MAP);

const MES_KEYS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;

function linhaVazia(resultado: string, ordem: number): DreLinhaImportada {
  return {
    ordem, resultado, totalAno: 0,
    jan: 0, fev: 0, mar: 0, abr: 0, mai: 0, jun: 0, jul: 0, ago: 0, set: 0, out: 0, nov: 0, dez: 0,
  };
}

function somarLinha(destino: DreLinhaImportada, origem: DreLinhaImportada) {
  for (const k of MES_KEYS) destino[k] += origem[k];
  destino.totalAno += origem.totalAno;
}

// GET /api/financeiro/dre-sistema?ano=2026
// Calcula o DRE inteiramente a partir do nosso próprio ledger (LancamentoFinanceiro +
// categoria), em vez de depender do Excel "Realizado" importado. Usa o mesmo plano de
// contas (código + nome) já herdado do Nibo na criação das categorias, então a estrutura
// de contas continua igual — só o valor passa a vir do que o sistema já registrou.
export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json([]);
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const { searchParams } = new URL(request.url);
    const ano = searchParams.get("ano") || String(new Date().getFullYear());

    // Só entra no DRE "ao vivo" o que já venceu/aconteceu de fato (dataCompetencia <= hoje)
    // ou já foi efetivamente pago — um lançamento futuro (ex: comissão com vencimento daqui
    // a 1 semana) não é despesa "já incorrida" e não pode derrubar o resultado do mês antes
    // da hora, mesmo que já esteja cadastrado no sistema.
    const rows = await sql`
      SELECT
        cat.codigo, cat.nome, cat.grupo,
        EXTRACT(MONTH FROM a."dataCompetencia"::date)::int AS mes,
        SUM(CASE WHEN a.tipo = 'receber' THEN acat.valor ELSE -acat.valor END) AS total
      FROM "LancamentoFinanceiro" a
      JOIN "LancamentoFinanceiroCategoria" acat ON acat."lancamentoId" = a.id
      JOIN "CategoriaFinanceira" cat ON cat.id = acat."categoriaId"
      WHERE a."dataCompetencia" LIKE ${ano + "-%"}
        AND cat.codigo IS NOT NULL
        AND (a."dataCompetencia"::date <= CURRENT_DATE OR a."valorPago" > 0)
      GROUP BY cat.codigo, cat.nome, cat.grupo, mes
      ORDER BY cat.codigo, mes
    `;

    // Agrupa por categoria (código) primeiro
    const porCategoria = new Map<string, { nome: string; grupo: string; linha: DreLinhaImportada }>();
    for (const r of rows as any[]) {
      const key = r.codigo;
      if (!porCategoria.has(key)) {
        // "nome" já vem com o código embutido (ex: "1.1.2.01.009-Reembolso/..."), herdado do Nibo
        porCategoria.set(key, { nome: r.nome, grupo: (r.grupo || "").toLowerCase().trim(), linha: linhaVazia(r.nome, 0) });
      }
      const entry = porCategoria.get(key)!;
      const mesKey = MES_KEYS[r.mes - 1];
      if (mesKey) {
        entry.linha[mesKey] += Number(r.total);
        entry.linha.totalAno += Number(r.total);
      }
    }

    const linhas: DreLinhaImportada[] = [];
    let ordem = 0;
    const totaisGrupo: Record<string, DreLinhaImportada> = {};

    for (const grupoKey of ORDEM_GRUPOS) {
      const { label } = GRUPO_MAP[grupoKey];
      const detalhes = Array.from(porCategoria.values())
        .filter(e => e.grupo === grupoKey)
        .sort((a, b) => a.linha.resultado.localeCompare(b.linha.resultado));

      const totalGrupo = linhaVazia(label, ordem++);
      for (const d of detalhes) somarLinha(totalGrupo, d.linha);
      totaisGrupo[grupoKey] = totalGrupo;

      linhas.push(totalGrupo);
      for (const d of detalhes) {
        d.linha.ordem = ordem++;
        linhas.push(d.linha);
      }
    }

    // Linhas de resultado — mesma lógica de dre-data.ts (getLucroBruto/getResultadoOperacional/getVariacaoCaixa),
    // só que somando os totais de grupo calculados acima em vez de ler de DRELancamento[].
    const margemContribuicao = linhaVazia("Margem de contribuição", ordem++);
    somarLinha(margemContribuicao, totaisGrupo["receitas operacionais"]);
    somarLinha(margemContribuicao, totaisGrupo["custos operacionais"]);
    linhas.push(margemContribuicao);

    const resultadoOperacional = linhaVazia("RESULTADO OPERACIONAL", ordem++);
    somarLinha(resultadoOperacional, margemContribuicao);
    somarLinha(resultadoOperacional, totaisGrupo["despesas operacionais e outras receitas"]);
    linhas.push(resultadoOperacional);

    const variacaoCaixa = linhaVazia("VARIAÇÃO DE CAIXA", ordem++);
    somarLinha(variacaoCaixa, resultadoOperacional);
    somarLinha(variacaoCaixa, totaisGrupo["atividades de investimento"]);
    somarLinha(variacaoCaixa, totaisGrupo["atividades de financiamento"]);
    linhas.push(variacaoCaixa);

    return NextResponse.json(linhas);
  } catch (error: any) {
    console.error("[GET /api/financeiro/dre-sistema]", error);
    return NextResponse.json({ error: error?.message || "Erro ao calcular DRE do sistema" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
