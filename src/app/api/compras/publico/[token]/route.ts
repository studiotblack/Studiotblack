import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getDb } from "@/lib/financeiro-db";
import { ensureComprasTables, tokenValido, carregarItensComEstatisticas } from "@/lib/compras-db";
import { obterGrupoAvisosJid, enviarTextoWhatsApp } from "@/lib/whatsapp/enviar-aviso";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_ITENS = 200;

// GET /api/compras/publico/[token] — lista pública (sem login) dos itens por setor, usada
// pelo formulário de checkpoint da recepção. Só devolve nomes e histórico de pedido: nada
// financeiro. O token é a única "chave" — se vazar, é trocado em /compras (aba Link).
export async function GET(_request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Indisponível." }, { status: 500 });
  const sql = getDb();
  try {
    await ensureComprasTables(sql);
    if (!(await tokenValido(sql, token))) {
      return NextResponse.json({ error: "Link inválido ou expirado." }, { status: 404 });
    }
    const itens = await carregarItensComEstatisticas(sql);
    return NextResponse.json({ itens });
  } catch (error: any) {
    console.error("[GET /api/compras/publico]", error);
    return NextResponse.json({ error: "Erro ao carregar a lista." }, { status: 500 });
  } finally {
    await sql.end();
  }
}

interface ItemEnvio {
  itemId: string;
  quantidade?: number | null;
  observacao?: string | null;
}
interface OutroItemEnvio {
  setor: string;
  nome: string;
  quantidade?: number | null;
}

const limpar = (s: unknown, max: number) => String(s ?? "").trim().slice(0, max);
const qtdValida = (q: unknown): number | null => {
  const n = Number(q);
  return Number.isFinite(n) && n > 0 && n < 10000 ? Math.floor(n) : null;
};

// POST /api/compras/publico/[token] — recebe o checkpoint: { nome, itens: [{itemId, quantidade?, observacao?}],
// outros: [{setor, nome, quantidade?}], observacao? }. Cria o envio e avisa no WhatsApp.
export async function POST(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Indisponível." }, { status: 500 });
  const sql = getDb();
  try {
    await ensureComprasTables(sql);
    if (!(await tokenValido(sql, token))) {
      return NextResponse.json({ error: "Link inválido ou expirado." }, { status: 404 });
    }

    const b = await request.json();
    const nome = limpar(b.nome, 60);
    const itens: ItemEnvio[] = Array.isArray(b.itens) ? b.itens : [];
    const outros: OutroItemEnvio[] = Array.isArray(b.outros) ? b.outros : [];
    if (!nome) return NextResponse.json({ error: "Informe o seu nome." }, { status: 400 });
    if (itens.length + outros.length === 0) return NextResponse.json({ error: "Marque ao menos um item." }, { status: 400 });
    if (itens.length + outros.length > MAX_ITENS) return NextResponse.json({ error: "Itens demais." }, { status: 400 });

    // Só aceita itens que existem, estão ativos e aprovados (ignora ids soltos/forjados).
    const ids = itens.map((i) => String(i.itemId));
    const validos = ids.length
      ? await sql`SELECT id, setor, nome FROM "CompraItem" WHERE id IN ${sql(ids)} AND ativo = true AND aprovado = true`
      : [];
    const validosPorId = new Map<string, { setor: string; nome: string }>(validos.map((v: any) => [v.id, { setor: v.setor, nome: v.nome }]));

    const resumo: { setor: string; nome: string; qtd: number | null; obs: string | null; sugerido: boolean }[] = [];

    const checklistId = await sql.begin(async (tx) => {
      const [chk] = await tx`
        INSERT INTO "CompraChecklist" ("preenchidoPor", observacao)
        VALUES (${nome}, ${limpar(b.observacao, 300) || null})
        RETURNING id
      `;
      const jaVistos = new Set<string>();
      for (const it of itens) {
        const info = validosPorId.get(String(it.itemId));
        if (!info || jaVistos.has(String(it.itemId))) continue;
        jaVistos.add(String(it.itemId));
        const qtd = qtdValida(it.quantidade);
        const obs = limpar(it.observacao, 200) || null;
        await tx`
          INSERT INTO "CompraPedidoItem" ("checklistId", "itemId", quantidade, observacao)
          VALUES (${chk.id}, ${String(it.itemId)}, ${qtd}, ${obs})
        `;
        resumo.push({ setor: info.setor, nome: info.nome, qtd, obs, sugerido: false });
      }
      // "Outro item": vira um CompraItem NÃO aprovado (aparece pra aprovar em /compras) e já
      // entra neste pedido, pra não depender de aprovação pra ser comprado.
      for (const o of outros) {
        const setor = limpar(o.setor, 40);
        const nomeItem = limpar(o.nome, 80);
        if (!setor || !nomeItem) continue;
        // herda o tipo (revenda/consumo) dos itens que já existem no mesmo setor
        const [irmao] = await tx`SELECT tipo FROM "CompraItem" WHERE setor = ${setor} ORDER BY ordem ASC LIMIT 1`;
        const [novo] = await tx`
          INSERT INTO "CompraItem" (setor, nome, tipo, ordem, aprovado)
          VALUES (${setor}, ${nomeItem}, ${irmao?.tipo ?? "revenda"}, 9999, false)
          RETURNING id
        `;
        const qtd = qtdValida(o.quantidade);
        await tx`
          INSERT INTO "CompraPedidoItem" ("checklistId", "itemId", quantidade)
          VALUES (${chk.id}, ${novo.id}, ${qtd})
        `;
        resumo.push({ setor, nome: nomeItem, qtd, obs: null, sugerido: true });
      }
      return chk.id as string;
    });

    if (resumo.length === 0) {
      await sql`DELETE FROM "CompraChecklist" WHERE id = ${checklistId}`;
      return NextResponse.json({ error: "Nenhum item válido na lista." }, { status: 400 });
    }

    // Aviso no WhatsApp DEPOIS de responder — a recepção não fica esperando a conexão abrir.
    // Falha no aviso nunca invalida o envio (a lista já está salva no sistema).
    // (`semAviso` só vale fora de produção — permite testar o envio sem mandar WhatsApp.)
    const semAviso = process.env.NODE_ENV !== "production" && b.semAviso === true;
    after(async () => {
      if (semAviso) return;
      try {
        const jid = await obterGrupoAvisosJid();
        if (!jid) return;
        await enviarTextoWhatsApp(jid, montarAviso(nome, resumo));
      } catch (err) {
        console.error("[compras] falha ao avisar no WhatsApp:", err);
      }
    });

    return NextResponse.json({ ok: true, id: checklistId, total: resumo.length });
  } catch (error: any) {
    console.error("[POST /api/compras/publico]", error);
    return NextResponse.json({ error: "Erro ao enviar a lista. Tente de novo." }, { status: 500 });
  } finally {
    await sql.end();
  }
}

function montarAviso(nome: string, resumo: { setor: string; nome: string; qtd: number | null; obs: string | null; sugerido: boolean }[]): string {
  const porSetor = new Map<string, typeof resumo>();
  for (const r of resumo) {
    if (!porSetor.has(r.setor)) porSetor.set(r.setor, []);
    porSetor.get(r.setor)!.push(r);
  }
  const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  const linhas: string[] = [`🛒 *Lista de compras* — ${nome} (${agora})`, `${resumo.length} ${resumo.length === 1 ? "item" : "itens"}`, ""];
  for (const [setor, itens] of porSetor) {
    linhas.push(`*${setor}*`);
    for (const i of itens) {
      const qtd = i.qtd ? ` ×${i.qtd}` : "";
      const obs = i.obs ? ` _(${i.obs})_` : "";
      const novo = i.sugerido ? " ✨novo" : "";
      linhas.push(`• ${i.nome}${qtd}${obs}${novo}`);
    }
    linhas.push("");
  }
  linhas.push("Detalhes e compra em Black Gestão → Compras.");
  return linhas.join("\n");
}
