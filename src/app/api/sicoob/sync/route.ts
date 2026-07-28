/**
 * API Route: /api/sicoob/sync
 * Busca extrato do Sicoob e converte para DRELancamento[]
 *
 * Query params:
 *   mes  — número do mês (1-12), default = mês atual
 *   ano  — ano (ex: 2026),      default = ano atual
 *
 * Env vars requeridas (em .env.local):
 *   SICOOB_CLIENT_ID  — client_id da aplicação Sicoob
 *   SICOOB_CERT       — conteúdo do certificado PEM (public key)
 *   SICOOB_KEY        — conteúdo da chave PEM (private key)
 *   SICOOB_CONTA      — número da conta corrente
 */
import { NextRequest, NextResponse } from "next/server";
import { SicoobClient } from "@/lib/bank/sicoob-client";
import type { DRELancamento, DREGrupo } from "@/lib/dre-data";

/**
 * Tenta inferir grupo e subcategoria a partir da descrição do lançamento bancário.
 * Em produção, o usuário pode ajustar manualmente antes de importar.
 */
function inferirCategoria(descricao: string, valor: number, tipo: "C" | "D"): {
  grupo: DREGrupo;
  subcategoria: string;
  tipoLancamento: "ENTRADA" | "SAIDA";
} {
  const desc = descricao.toLowerCase();
  const tipoLancamento: "ENTRADA" | "SAIDA" = tipo === "C" ? "ENTRADA" : "SAIDA";

  if (tipo === "C") {
    // Créditos → geralmente receita
    if (desc.includes("pix") || desc.includes("pagamento") || desc.includes("recebimento")) {
      return { grupo: "receita", subcategoria: "Serviços", tipoLancamento };
    }
    return { grupo: "receita", subcategoria: "Serviços", tipoLancamento };
  }

  // Débitos → tentar classificar
  if (desc.includes("aluguel") || desc.includes("locacao")) {
    return { grupo: "despesa", subcategoria: "Aluguel", tipoLancamento };
  }
  if (desc.includes("folha") || desc.includes("salario") || desc.includes("pagamento func")) {
    return { grupo: "despesa", subcategoria: "Salários", tipoLancamento };
  }
  if (desc.includes("contador") || desc.includes("contabil")) {
    return { grupo: "despesa", subcategoria: "Contador", tipoLancamento };
  }
  if (desc.includes("imposto") || desc.includes("das ") || desc.includes("simples") || desc.includes("tribut")) {
    return { grupo: "despesa", subcategoria: "Tributário", tipoLancamento };
  }
  if (desc.includes("emprestimo") || desc.includes("financiamento") || desc.includes("parcela")) {
    return { grupo: "financiamento", subcategoria: "Empréstimos", tipoLancamento };
  }
  if (desc.includes("pro-labore") || desc.includes("prolabore") || desc.includes("socio") || desc.includes("retirada")) {
    return { grupo: "financiamento", subcategoria: "Retirada do Sócio", tipoLancamento };
  }
  if (desc.includes("equipamento") || desc.includes("maquina") || desc.includes("reforma")) {
    return { grupo: "investimento", subcategoria: "Equipamentos", tipoLancamento };
  }
  if (desc.includes("produto") || desc.includes("insumo") || desc.includes("material")) {
    return { grupo: "custo", subcategoria: "Insumos", tipoLancamento };
  }
  if (desc.includes("comissao") || desc.includes("comissão")) {
    return { grupo: "custo", subcategoria: "Comissões", tipoLancamento };
  }

  // Fallback genérico
  return { grupo: "despesa", subcategoria: "Financeiro", tipoLancamento };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const now = new Date();
  const mes = parseInt(searchParams.get("mes") ?? String(now.getMonth() + 1));
  const ano = parseInt(searchParams.get("ano") ?? String(now.getFullYear()));

  // Verificar variáveis de ambiente
  const clientId = process.env.SICOOB_CLIENT_ID;
  const cert     = process.env.SICOOB_CERT;
  const key      = process.env.SICOOB_KEY;
  const conta    = process.env.SICOOB_CONTA;

  if (!clientId || !cert || !key || !conta) {
    return NextResponse.json(
      {
        ok: false,
        error: "Credenciais Sicoob não configuradas. Defina SICOOB_CLIENT_ID, SICOOB_CERT, SICOOB_KEY e SICOOB_CONTA no arquivo .env.local",
        lancamentos: [],
      },
      { status: 200 } // 200 para não quebrar o frontend; ok=false indica estado
    );
  }

  try {
    const client = new SicoobClient(clientId, cert, key);
    const extrato = await client.getExtrato(conta, mes, ano);

    // A API Sicoob v4 retorna: { resultado: { lancamentos: [...] } }
    const rawLancamentos: any[] =
      extrato?.resultado?.lancamentos ?? extrato?.lancamentos ?? [];

    const lancamentos: DRELancamento[] = rawLancamentos.map((l: any, i: number) => {
      const valor   = Math.abs(Number(l.valor ?? l.vlrLancamento ?? 0));
      const tipoOFX: "C" | "D" = l.tipoLancamento === "C" || (l.valor ?? 0) > 0 ? "C" : "D";
      const descricao = l.descricao ?? l.historico ?? l.memo ?? "Lançamento bancário";
      const data = l.dataLancamento ?? l.data ?? `2026-${String(mes).padStart(2,"0")}-01`;

      const { grupo, subcategoria, tipoLancamento } = inferirCategoria(descricao, valor, tipoOFX);

      return {
        id: `sicoob-${mes}-${ano}-${i}`,
        data: data.slice(0, 10), // garante formato YYYY-MM-DD
        descricao,
        valor,
        tipo: tipoLancamento,
        grupo,
        subcategoria,
        origem: "banco" as const,
        importadoSicoob: true,
      };
    });

    return NextResponse.json({
      ok: true,
      mes,
      ano,
      total: lancamentos.length,
      lancamentos,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? "Erro desconhecido ao conectar ao Sicoob",
        lancamentos: [],
      },
      { status: 200 }
    );
  }
}
