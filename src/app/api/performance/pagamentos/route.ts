import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import { PROFISSIONAL_CONTATO_MAP, isProduto } from "@/lib/performance-data";

export const dynamic = "force-dynamic";

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Variável DATABASE_URL não configurada no servidor.");
  }
  const isPooler = url.includes("pooler.supabase.com") || url.includes(":6543") || url.includes("pgbouncer=true");
  return postgres(url, {
    ssl: "require",
    prepare: !isPooler,
  });
}

let tableEnsured = false;

async function ensureMetaTable(sql: ReturnType<typeof postgres>) {
  if (tableEnsured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS "MetaProfissional" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "contatoId" TEXT NOT NULL,
      "mesAno" TEXT NOT NULL,
      "metaServicos" FLOAT NOT NULL,
      "metaProdutos" FLOAT NOT NULL,
      "metaTicket" FLOAT NOT NULL,
      "bonusServicos" FLOAT NOT NULL,
      "bonusProdutos" FLOAT NOT NULL,
      "bonusTicket" FLOAT NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE("contatoId", "mesAno")
    )
  `;
  tableEnsured = true;
}

// "MM/YYYY" -> { inicio: "YYYY-MM-01", fim: "YYYY-MM-31" } (dataCompetencia é guardada como string YYYY-MM-DD)
function limitesDoMes(mesAno: string): { inicio: string; fim: string } {
  const [mes, ano] = mesAno.split("/");
  const ultimoDia = new Date(Number(ano), Number(mes), 0).getDate();
  return {
    inicio: `${ano}-${mes.padStart(2, "0")}-01`,
    fim: `${ano}-${mes.padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`,
  };
}

// GET /api/performance/pagamentos?mesAno=09/2026
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mesAno = searchParams.get("mesAno");
  if (!mesAno) {
    return NextResponse.json({ error: "mesAno é obrigatório (formato MM/YYYY)" }, { status: 400 });
  }
  if (!process.env.DATABASE_URL) return NextResponse.json([], { status: 200 });

  const sql = getDb();
  try {
    await ensureMetaTable(sql);
    const { inicio, fim } = limitesDoMes(mesAno);

    const resultados = await Promise.all(
      Object.entries(PROFISSIONAL_CONTATO_MAP).map(async ([nome, contatoId]) => {
        const vendas = await sql`
          SELECT item, "valorComissao" FROM "DesempenhoProfissionalDB"
          WHERE "contatoId" = ${contatoId} AND "mesAno" = ${mesAno}
        `;

        let comissaoServicos = 0;
        let comissaoProdutos = 0;
        for (const v of vendas) {
          if (isProduto(v.item)) comissaoProdutos += Number(v.valorComissao);
          else comissaoServicos += Number(v.valorComissao);
        }
        const total = comissaoServicos + comissaoProdutos;

        const [meta] = await sql`SELECT * FROM "MetaProfissional" WHERE "contatoId" = ${contatoId} AND "mesAno" = ${mesAno}`;

        const lancamentos = await sql`
          SELECT id, valor, "valorPago", descricao, "dataVencimento" FROM "LancamentoFinanceiro"
          WHERE "contatoId" = ${contatoId} AND tipo = 'pagar'
            AND "dataCompetencia" BETWEEN ${inicio} AND ${fim}
        `;

        const isBonusLanc = (descricao: string) => /meta|b[ôo]nus/i.test(descricao || "");
        const comissaoLanc = lancamentos.filter((l: any) => !isBonusLanc(l.descricao));
        const bonusLanc = lancamentos.filter((l: any) => isBonusLanc(l.descricao));

        const somaLanc = (arr: any[]) => ({
          valor: arr.reduce((acc, l) => acc + Number(l.valor), 0),
          valorPago: arr.reduce((acc, l) => acc + Number(l.valorPago), 0),
        });

        let metaInfo = null;
        if (meta) {
          const metaTotal = Number(meta.metaServicos) + Number(meta.metaProdutos);
          metaInfo = {
            metaServicos: Number(meta.metaServicos),
            metaProdutos: Number(meta.metaProdutos),
            bonusServicos: Number(meta.bonusServicos),
            bonusProdutos: Number(meta.bonusProdutos),
            bateuServicos: comissaoServicos >= Number(meta.metaServicos) && Number(meta.metaServicos) > 0,
            bateuProdutos: comissaoProdutos >= Number(meta.metaProdutos) && Number(meta.metaProdutos) > 0,
            bateuTotal: total >= metaTotal && metaTotal > 0,
          };
        }

        return {
          nome,
          contatoId,
          comissaoServicos,
          comissaoProdutos,
          total,
          meta: metaInfo,
          financeiro: {
            comissao: somaLanc(comissaoLanc),
            bonus: bonusLanc.length > 0 ? somaLanc(bonusLanc) : null,
          },
        };
      })
    );

    return NextResponse.json(resultados);
  } catch (error: any) {
    console.error("[GET /api/performance/pagamentos]", error);
    return NextResponse.json({ error: error?.message || "Erro ao buscar pagamentos" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
