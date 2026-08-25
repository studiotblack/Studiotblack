import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";

export const dynamic = "force-dynamic";

function inicioPeriodo(periodo: string): string {
  const hoje = new Date();
  if (periodo === "hoje") return hoje.toISOString().slice(0, 10);
  if (periodo === "semana") {
    const diaSemana = hoje.getDay(); // 0=domingo
    const seg = new Date(hoje);
    seg.setDate(hoje.getDate() - ((diaSemana + 6) % 7)); // segunda-feira desta semana
    return seg.toISOString().slice(0, 10);
  }
  // mes
  return new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
}

// GET /api/financeiro/resumo-dashboard?periodo=hoje|semana|mes
// Faturamento do período (entradas reais do extrato bancário, regime de caixa) + saldo
// líquido consolidado atual (mesma lógica de "Saldo em Caixa Hoje" do Fluxo de Caixa) —
// usado pelos cards do Dashboard principal.
export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ faturamentoPeriodo: 0, saldoLiquido: 0 });
  }
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const { searchParams } = new URL(request.url);
    const periodo = searchParams.get("periodo") || "mes";
    const dataInicio = inicioPeriodo(periodo);
    const hoje = new Date().toISOString().slice(0, 10);

    const [{ faturamento }] = await sql`
      SELECT COALESCE(SUM(valor), 0) AS faturamento
      FROM "TransacaoBancariaImportada"
      WHERE tipo = 'entrada' AND data >= ${dataInicio} AND data <= ${hoje}
    `;

    // Saldo por conta: confia no saldo real do Sicoob quando a conta está conectada,
    // senão calcula a partir do saldo inicial + baixas + transferências (mesma regra
    // usada no card "Saldo em Caixa Hoje" do Fluxo de Caixa).
    const contas = await sql`SELECT * FROM "ContaBancaria" WHERE ativa = true`;
    const baixas = await sql`
      SELECT b."contaBancariaId", b.valor, a.tipo AS "agendamentoTipo"
      FROM "Baixa" b JOIN "LancamentoFinanceiro" a ON a.id = b."lancamentoId"
    `;
    const transferencias = await sql`SELECT * FROM "Transferencia"`;

    let saldoLiquido = 0;
    for (const conta of contas) {
      if (conta.sicoobClientId && conta.saldoSicoob !== null && conta.saldoSicoob !== undefined) {
        saldoLiquido += Number(conta.saldoSicoob);
        continue;
      }
      const entradas = baixas.filter((b) => b.contaBancariaId === conta.id && b.agendamentoTipo === "receber").reduce((acc, b) => acc + Number(b.valor), 0);
      const saidas = baixas.filter((b) => b.contaBancariaId === conta.id && b.agendamentoTipo === "pagar").reduce((acc, b) => acc + Number(b.valor), 0);
      const transfRecebidas = transferencias.filter((t) => t.contaDestinoId === conta.id).reduce((acc, t) => acc + Number(t.valor), 0);
      const transfEnviadas = transferencias.filter((t) => t.contaOrigemId === conta.id).reduce((acc, t) => acc + Number(t.valor), 0);
      saldoLiquido += Number(conta.saldoInicial) + entradas - saidas + transfRecebidas - transfEnviadas;
    }

    return NextResponse.json({ faturamentoPeriodo: Number(faturamento), saldoLiquido });
  } catch (error: unknown) {
    console.error("[GET /api/financeiro/resumo-dashboard]", error);
    const message = error instanceof Error ? error.message : "Erro ao buscar resumo do dashboard";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await sql.end();
  }
}
