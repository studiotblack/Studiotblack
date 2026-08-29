import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";

export const dynamic = "force-dynamic";

// GET /api/financeiro/transacoes-bancarias?contaBancariaId=&mes=&ano=
export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json([], { status: 200 });
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const { searchParams } = new URL(request.url);
    const contaBancariaId = searchParams.get("contaBancariaId");
    const mes = searchParams.get("mes");
    const ano = searchParams.get("ano");

    const filtroMes = mes && ano ? `${ano}-${mes.padStart(2, "0")}` : null;

    const rows = await sql`
      SELECT
        t.*,
        l.descricao AS "lancamentoDescricao",
        comp."textoLegenda" AS "comprovanteLegenda",
        COALESCE(comp."categoriaSugeridaId", regra."categoriaId") AS "categoriaSugeridaId",
        COALESCE(catSug.nome, catRegra.nome) AS "categoriaSugeridaNome",
        regra."contatoId" AS "contatoSugeridoId",
        contSug.nome AS "contatoSugeridoNome",
        regra."centroCustoId" AS "centroCustoSugeridoId",
        wcVinc."textoLegenda" AS "comprovanteWhatsappLegenda"
      FROM "TransacaoBancariaImportada" t
      LEFT JOIN "LancamentoFinanceiro" l ON l.id = t."lancamentoId"
      -- Vínculo real (já conciliado via comprovante do WhatsApp), diferente do "comp"
      -- abaixo que é só o palpite de sugestão pra quem ainda está pendente.
      LEFT JOIN "WhatsappComprovante" wcVinc ON wcVinc."transacaoBancariaId" = t.id
      LEFT JOIN LATERAL (
        SELECT * FROM "WhatsappComprovante" wc
        WHERE wc.status = 'pendente'
          AND wc."valorOcr" IS NOT NULL
          AND t.tipo = 'saida'
          AND t.status = 'pendente'
          AND wc."valorOcr" BETWEEN t.valor - 0.02 AND t.valor + 0.02
        ORDER BY ABS(wc."dataHoraEnvio"::date - t.data::date)
        LIMIT 1
      ) comp ON true
      LEFT JOIN "CategoriaFinanceira" catSug ON catSug.id = comp."categoriaSugeridaId"
      -- "Palpite" aprendido na conciliação manual anterior (mesma ideia do Nibo: reconhece
      -- o nome/descrição do banco e já pré-preenche contato + categoria) — só pra saídas
      -- ainda pendentes, igual à regra que o WhatsApp usa.
      LEFT JOIN LATERAL (
        SELECT * FROM "RegraConciliacaoBancaria" r
        WHERE t.tipo = 'saida' AND t.status = 'pendente'
          AND t.descricao ILIKE '%' || r."padraoDescricao" || '%'
        ORDER BY LENGTH(r."padraoDescricao") DESC
        LIMIT 1
      ) regra ON true
      LEFT JOIN "Contato" contSug ON contSug.id = regra."contatoId"
      LEFT JOIN "CategoriaFinanceira" catRegra ON catRegra.id = regra."categoriaId"
      WHERE 1=1
        ${contaBancariaId ? sql`AND t."contaBancariaId" = ${contaBancariaId}` : sql``}
        ${filtroMes ? sql`AND t.data LIKE ${filtroMes + "%"}` : sql``}
      ORDER BY t.data DESC, t."createdAt" DESC
    `;

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("[GET /api/financeiro/transacoes-bancarias]", error);
    return NextResponse.json({ error: error?.message || "Erro ao buscar transações bancárias" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
