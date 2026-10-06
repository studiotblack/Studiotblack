/**
 * Script de pareamento único do WhatsApp (rodar uma vez só).
 * Gera um QR code em scripts/whatsapp-qr.png — escaneie com o WhatsApp
 * (Aparelhos conectados -> Conectar um aparelho) que vai ficar dedicado à sincronização.
 * A sessão fica salva no Postgres (tabela WhatsappAuthState), então depois desse
 * pareamento não precisa escanear de novo — a rota de sincronização reconecta sozinha.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(__dirname + "/..");

import path from "node:path";
import QRCode from "qrcode";
import makeWASocket, { fetchLatestBaileysVersion, Browsers, DisconnectReason } from "@whiskeysockets/baileys";
import { getDb } from "../src/lib/financeiro-db";
import { carregarAuthStatePostgres } from "../src/lib/whatsapp/auth-state";

const QR_PATH = path.join(__dirname, "whatsapp-qr.png");

async function conectar(sql: ReturnType<typeof getDb>): Promise<void> {
  const { state, saveCreds } = await carregarAuthStatePostgres(sql);
  const { version } = await fetchLatestBaileysVersion();
  const telefone = process.argv[2]?.replace(/\D/g, "");

  const sock = makeWASocket({
    auth: state,
    version,
    // Pareamento por código só é aceito pelo WhatsApp se o aparelho se identifica como navegador comum
    browser: telefone ? Browsers.ubuntu("Chrome") : Browsers.macOS("Desktop"),
    syncFullHistory: false,
  });

  // Alternativa ao QR (que expira em ~20s): passando o número (com DDI, só dígitos) como
  // argumento, gera um código de 8 caracteres pra digitar em Aparelhos conectados ->
  // Conectar com número de telefone. Ex: npx tsx scripts/whatsapp-pair.ts 5512999999999
  if (telefone && !state.creds.registered) {
    setTimeout(async () => {
      try {
        const codigo = await sock.requestPairingCode(telefone);
        console.log("CODIGO_PAREAMENTO:" + codigo);
      } catch (err) {
        console.log("ERRO_CODIGO", err);
      }
    }, 4000);
  }

  return new Promise((resolve, reject) => {
    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, qr, lastDisconnect } = update;

      if (qr) {
        await QRCode.toFile(QR_PATH, qr, { width: 500, margin: 1 });
        console.log("QR_GERADO:" + QR_PATH);
      }

      if (connection === "open") {
        console.log("CONECTADO");
        try {
          const grupos = await sock.groupFetchAllParticipating();
          console.log("TOTAL_GRUPOS:" + Object.keys(grupos).length);
          for (const [jid, g] of Object.entries(grupos)) {
            const marca = g.subject.toLowerCase().includes("gastos") && g.subject.toLowerCase().includes("black") ? " <== ALVO" : "";
            console.log(`GRUPO: ${jid} | ${g.subject}${marca}`);
          }
          resolve();
        } catch (err) {
          reject(err);
        }
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const deveReconectar = statusCode !== DisconnectReason.loggedOut;
        console.log("CONEXAO_FECHADA statusCode=" + statusCode + " reconectar=" + deveReconectar);
        if (statusCode === DisconnectReason.timedOut && !state.creds.registered) {
          // QR/código expirou sem ninguém parear: as credenciais parciais ficam "sujas" e uma
          // reconexão com elas só leva 401. Melhor parar e rodar de novo do zero.
          reject(new Error("QR/código expirou sem parear — limpe a WhatsappAuthState e rode de novo."));
        } else if (deveReconectar) {
          // Reconexão exigida pelo próprio WhatsApp (comum logo após parear) — cria um
          // socket novo reaproveitando a mesma sessão salva, sem precisar de QR de novo.
          conectar(sql).then(resolve, reject);
        } else {
          reject(new Error("Sessão encerrada (logged out) — precisa parear com QR novo."));
        }
      }
    });
  });
}

async function main() {
  const sql = getDb();
  try {
    await conectar(sql);
  } finally {
    await sql.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("ERRO_GERAL", err);
    process.exit(1);
  });
