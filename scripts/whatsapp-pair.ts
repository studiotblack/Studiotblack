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

  const sock = makeWASocket({
    auth: state,
    version,
    browser: Browsers.macOS("Desktop"),
    syncFullHistory: false,
  });

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
        if (deveReconectar) {
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
