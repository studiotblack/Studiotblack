import makeWASocket, { fetchLatestBaileysVersion, Browsers, DisconnectReason } from "@whiskeysockets/baileys";
import { getDb, ensureFinanceiroTables } from "@/lib/financeiro-db";
import { carregarAuthStatePostgres } from "@/lib/whatsapp/auth-state";

// Lê o grupo de avisos configurado (MetaFinanceira.whatsappGrupoAvisosJid).
export async function obterGrupoAvisosJid(): Promise<string | null> {
  const sql = getDb();
  try {
    await ensureFinanceiroTables(sql);
    const [meta] = await sql`SELECT "whatsappGrupoAvisosJid" FROM "MetaFinanceira" WHERE id = 'default'`;
    return meta?.whatsappGrupoAvisosJid ?? null;
  } finally {
    await sql.end();
  }
}

// Abre a sessão do Baileys (guardada no Postgres), manda UMA mensagem de texto pro JID e fecha.
// Mesma mecânica do aviso semanal do Contas a Pagar — só "envia", nunca baixa histórico.
export async function enviarTextoWhatsApp(jid: string, texto: string): Promise<void> {
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
            await sock.sendMessage(jid, { text: texto });
            encerrar();
          } catch (err) {
            encerrar(err instanceof Error ? err : new Error(String(err)));
          }
        }
        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
          if (statusCode === DisconnectReason.loggedOut) {
            encerrar(new Error("Sessão do WhatsApp desconectada (logged out) — precisa parear com código novo."));
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
}
