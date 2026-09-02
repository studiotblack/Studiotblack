import makeWASocket, {
  fetchLatestBaileysVersion,
  Browsers,
  DisconnectReason,
  proto,
  normalizeMessageContent,
  type WAMessage,
} from "@whiskeysockets/baileys";
import type { Sql } from "@/lib/financeiro-db";
import { carregarAuthStatePostgres } from "./auth-state";

// Quanto tempo esperar depois de conectar pra receber mensagens que chegaram enquanto
// a gente estava offline (o WhatsApp reenvia esse backlog assim que reconecta, igual
// reabrir o WhatsApp Web) — sem isso a gente só pegaria mensagens que chegassem
// exatamente durante essa janela, e nunca o que já estava esperando.
// Precisa ser generoso: com o histórico ativado, o Baileys espera até 20s pela
// notificação de sincronização antes de liberar o buffer, e só depois disso baixa
// e decripta o pacote de histórico (onde as mensagens offline realmente chegam).
const JANELA_ESCUTA_MS = 30_000;

// Rede de segurança contra loop de reconexão: se a conexão cair repetidamente antes
// de sequer abrir (ex: sessão temporariamente rejeitada pelo WhatsApp), reconectar sem
// limite nem espera vira um martelamento nos servidores deles — risco real de bloqueio
// da conta. Limita tentativas e espera um pouco entre elas.
const MAX_TENTATIVAS_RECONEXAO = 5;
const ATRASO_ENTRE_TENTATIVAS_MS = 3_000;

// Teto absoluto pra função inteira: se a conexão nunca disparar "open" nem "close" (o
// socket fica preso em "connecting" — acontece em ambiente serverless, onde a conexão
// WebSocket de saída pode nunca completar o handshake), nenhum dos timeouts/reconexões
// acima dispara, e sem isso a Promise ficava pendente pra sempre — foi o que deixou o
// botão travado em "Lendo comprovantes..." indefinidamente em produção.
const TIMEOUT_TOTAL_MS = 45_000;

function aguardar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Conecta no WhatsApp reaproveitando a sessão já pareada, escuta por um tempo curto,
// coleta as mensagens de IMAGEM do grupo alvo, e desconecta. Não fica ligado — é chamado
// uma vez por clique de "Sincronizar".
export async function coletarMensagensDoGrupo(sql: Sql, grupoJid: string): Promise<WAMessage[]> {
  const mensagens: WAMessage[] = [];

  const idsColetados = new Set<string>();
  let tentativas = 0;

  function coletar(msg: WAMessage) {
    if (msg.key.remoteJid !== grupoJid) return;
    // Desembrulha mensagens temporárias/"visualizar uma vez" — nelas a imagem não fica
    // direto em msg.message.imageMessage, e o filtro antigo deixava passar batido.
    const conteudo = normalizeMessageContent(msg.message);
    if (!conteudo?.imageMessage) {
      console.log("[whatsapp] mensagem do grupo alvo sem imagem reconhecida:", JSON.stringify(Object.keys(msg.message || {})));
      return;
    }
    const id = msg.key.id;
    if (id) {
      if (idsColetados.has(id)) return;
      idsColetados.add(id);
    }
    mensagens.push({ ...msg, message: conteudo });
  }

  async function conectar(): Promise<void> {
    const { state, saveCreds } = await carregarAuthStatePostgres(sql);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      auth: state,
      version,
      browser: Browsers.macOS("Desktop"),
      // syncFullHistory:true anuncia esse device como um app desktop nativo (em vez do
      // perfil "navegador" com que a sessão foi pareada) e o WhatsApp derruba a conexão
      // na hora por causa dessa divergência de identidade — era o que causava
      // "Connection Terminated" em toda tentativa de sincronizar. Mas deixar false sem
      // mais nada também desliga silenciosamente o download do pacote "RECENT" (as
      // mensagens perdidas enquanto a sessão ficou offline, que é exatamente o que a
      // gente quer capturar) — por isso o shouldSyncHistoryMessage abaixo libera só
      // esse tipo, sem reativar o requireFullSync que quebrava a conexão.
      syncFullHistory: false,
      shouldSyncHistoryMessage: (msg) => msg.syncType === proto.HistorySync.HistorySyncType.RECENT,
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
        console.log(`[whatsapp] messages.upsert: ${evento.messages.length} msg(s) - jids: ${evento.messages.map((m) => m.key.remoteJid).join(", ")}`);
        for (const msg of evento.messages) coletar(msg);
      });

      // Mensagens recebidas enquanto a sessão estava offline chegam por esse evento
      // (sincronização de histórico), não por "messages.upsert" — sem isso, comprovantes
      // enviados antes de clicar em "Sincronizar" nunca eram capturados.
      sock.ev.on("messaging-history.set", (evento) => {
        console.log(`[whatsapp] messaging-history.set: ${evento.messages.length} msg(s) - jids: ${evento.messages.map((m) => m.key.remoteJid).join(", ")}`);
        for (const msg of evento.messages) coletar(msg);
      });

      sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "open") {
          tentativas = 0; // conexão de fato estabeleceu — zera o contador de falhas
          // Espera a janela pra receber o backlog de mensagens offline, depois encerra
          timeoutId = setTimeout(encerrar, JANELA_ESCUTA_MS);
        }

        if (connection === "close") {
          if (timeoutId) clearTimeout(timeoutId);
          if (encerrado) return;
          const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
          const deveReconectar = statusCode !== DisconnectReason.loggedOut;
          if (!deveReconectar) {
            reject(new Error("Sessão do WhatsApp desconectada (logged out) — precisa parear com QR novo."));
            return;
          }
          tentativas += 1;
          if (tentativas > MAX_TENTATIVAS_RECONEXAO) {
            reject(new Error(`Não foi possível manter a conexão com o WhatsApp após ${MAX_TENTATIVAS_RECONEXAO} tentativas.`));
            return;
          }
          // Espera antes de tentar de novo pra não martelar os servidores do WhatsApp
          // caso a conexão esteja caindo repetidamente antes de abrir.
          aguardar(ATRASO_ENTRE_TENTATIVAS_MS).then(() => conectar().then(resolve, reject));
        }
      });
    });
  }

  const timeoutTotal = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Sincronização do WhatsApp travou (sem resposta em ${TIMEOUT_TOTAL_MS / 1000}s) — tente novamente em instantes.`)), TIMEOUT_TOTAL_MS);
  });

  await Promise.race([conectar(), timeoutTotal]);
  return mensagens;
}
