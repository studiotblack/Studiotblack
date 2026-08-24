import makeWASocket, {
  fetchLatestBaileysVersion,
  Browsers,
  DisconnectReason,
  type WAMessage,
} from "@whiskeysockets/baileys";
import type { Sql } from "@/lib/financeiro-db";
import { carregarAuthStatePostgres } from "./auth-state";

// Quanto tempo esperar depois de conectar pra receber mensagens que chegaram enquanto
// a gente estava offline (o WhatsApp reenvia esse backlog assim que reconecta, igual
// reabrir o WhatsApp Web) — sem isso a gente só pegaria mensagens que chegassem
// exatamente durante essa janela, e nunca o que já estava esperando.
const JANELA_ESCUTA_MS = 12_000;

// Conecta no WhatsApp reaproveitando a sessão já pareada, escuta por um tempo curto,
// coleta as mensagens de IMAGEM do grupo alvo, e desconecta. Não fica ligado — é chamado
// uma vez por clique de "Sincronizar".
export async function coletarMensagensDoGrupo(sql: Sql, grupoJid: string): Promise<WAMessage[]> {
  const mensagens: WAMessage[] = [];

  async function conectar(): Promise<void> {
    const { state, saveCreds } = await carregarAuthStatePostgres(sql);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      auth: state,
      version,
      browser: Browsers.macOS("Desktop"),
      syncFullHistory: false,
    });

    return new Promise((resolve, reject) => {
      let encerrado = false;
      let timeoutId: NodeJS.Timeout | null = null;

      const encerrar = async () => {
        if (encerrado) return;
        encerrado = true;
        if (timeoutId) clearTimeout(timeoutId);
        try {
          sock.end(undefined);
        } catch {
          // ignora erro ao fechar
        }
        resolve();
      };

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("messages.upsert", (evento) => {
        for (const msg of evento.messages) {
          if (msg.key.remoteJid !== grupoJid) continue;
          if (!msg.message?.imageMessage) continue;
          mensagens.push(msg);
        }
      });

      sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "open") {
          // Espera a janela pra receber o backlog de mensagens offline, depois encerra
          timeoutId = setTimeout(encerrar, JANELA_ESCUTA_MS);
        }

        if (connection === "close") {
          if (timeoutId) clearTimeout(timeoutId);
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const deveReconectar = statusCode !== DisconnectReason.loggedOut;
          if (encerrado) return;
          if (deveReconectar) {
            // Reconexão normal (ex: restart logo após qualquer mudança de sessão) — tenta de novo
            conectar().then(resolve, reject);
          } else {
            reject(new Error("Sessão do WhatsApp desconectada (logged out) — precisa parear com QR novo."));
          }
        }
      });
    });
  }

  await conectar();
  return mensagens;
}
