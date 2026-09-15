import { NextResponse } from "next/server";
import makeWASocket, { fetchLatestBaileysVersion, Browsers, DisconnectReason } from "@whiskeysockets/baileys";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";
import { carregarAuthStatePostgres } from "@/lib/whatsapp/auth-state";
import { bucketAgendamento } from "@/lib/financeiro-data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function montarMensagem(vencidas: any[], estaSemana: any[]): string {
  if (vencidas.length === 0 && estaSemana.length === 0) {
    return "✅ Nenhuma conta vencida ou pra essa semana no Black Gestão. Tudo em dia!";
  }

  const linhas: string[] = ["*Contas a pagar — aviso semanal*", ""];
  let total = 0;

  const secao = (titulo: string, itens: any[]) => {
    if (itens.length === 0) return;
    linhas.push(titulo);
    for (const item of itens) {
      const emAberto = item.valor - item.valorPago;
      total += emAberto;
      const fornecedor = item.contatoNome ? ` — ${item.contatoNome}` : "";
      linhas.push(`• ${item.descricao}${fornecedor} — ${formatarMoeda(emAberto)} (vence ${formatarData(item.dataVencimento)})`);
    }
    linhas.push("");
  };

  secao("🔴 *Vencidas*", vencidas);
  secao("🟡 *Esta semana*", estaSemana);

  linhas.push(`*Total em aberto: ${formatarMoeda(total)}*`);
  return linhas.join("\n");
}

// POST /api/financeiro/whatsapp/avisar-contas-pagar — monta e envia no grupo configurado
// (MetaFinanceira.whatsappGrupoAvisosJid) o resumo das contas a pagar vencidas + desta
// semana. Chamado pelo cron semanal (ver /api/cron/avisar-contas-pagar), mas também pode
// ser disparado manualmente pra teste.
export async function POST() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Variável DATABASE_URL não configurada." }, { status: 500 });
  }

  const sql = getDb();
  let grupoJid: string | null = null;
  let mensagem: string;
  try {
    await ensureFinanceiroTables(sql);
    const [meta] = await sql`SELECT "whatsappGrupoAvisosJid" FROM "MetaFinanceira" WHERE id = 'default'`;
    grupoJid = meta?.whatsappGrupoAvisosJid ?? null;
    if (!grupoJid) {
      return NextResponse.json({ error: "Grupo de avisos do WhatsApp ainda não configurado (MetaFinanceira.whatsappGrupoAvisosJid)." }, { status: 400 });
    }

    const lancamentos = await sql`
      SELECT a.*, c.nome AS "contatoNome"
      FROM "LancamentoFinanceiro" a
      JOIN "Contato" c ON c.id = a."contatoId"
      WHERE a.tipo = 'pagar' AND a."valorPago" < a.valor
      ORDER BY a."dataVencimento" ASC
    `;

    const vencidas = lancamentos.filter((l: any) => bucketAgendamento(l) === "vencido");
    const estaSemana = lancamentos.filter((l: any) => bucketAgendamento(l) === "estaSemana");
    mensagem = montarMensagem(vencidas, estaSemana);
  } finally {
    await sql.end();
  }

  const sqlAuth = getDb();
  try {
    const { state, saveCreds } = await carregarAuthStatePostgres(sqlAuth);
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
      auth: state,
      version,
      browser: Browsers.macOS("Desktop"),
      syncFullHistory: false,
    });

    await new Promise<void>((resolve, reject) => {
      let encerrado = false;
      const encerrar = (erro?: Error) => {
        if (encerrado) return;
        encerrado = true;
        try {
          sock.end(undefined);
        } catch {
          // ignora erro ao fechar
        }
        if (erro) reject(erro);
        else resolve();
      };

      sock.ev.on("creds.update", saveCreds);
      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
          try {
            await sock.sendMessage(grupoJid!, { text: mensagem });
            encerrar();
          } catch (err) {
            encerrar(err instanceof Error ? err : new Error(String(err)));
          }
        }
        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
          if (statusCode === DisconnectReason.loggedOut) {
            encerrar(new Error("Sessão do WhatsApp desconectada (logged out) — precisa parear com QR novo."));
          } else if (!encerrado) {
            encerrar(new Error("Conexão com o WhatsApp fechou antes de enviar a mensagem."));
          }
        }
      });

      setTimeout(() => encerrar(new Error("Timeout ao conectar no WhatsApp pra enviar o aviso.")), 25_000);
    });
  } finally {
    await sqlAuth.end();
  }

  return NextResponse.json({ ok: true, grupoJid, mensagem });
}
