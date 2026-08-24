import { proto, initAuthCreds, BufferJSON } from "@whiskeysockets/baileys";
import type { Sql } from "@/lib/financeiro-db";

// Mesma lógica do useMultiFileAuthState oficial do Baileys, só que gravando num único
// banco Postgres em vez de arquivos soltos — necessário porque a Vercel (onde o site
// roda) não tem um filesystem persistente entre chamadas. Reconectar em produção
// (dentro da rota de sincronização) lê a mesma sessão pareada aqui uma única vez.
export async function ensureWhatsappAuthTable(sql: Sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS "WhatsappAuthState" (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
}

export async function usePostgresAuthState(sql: Sql) {
  await ensureWhatsappAuthTable(sql);

  const readData = async (key: string) => {
    const [row] = await sql`SELECT valor FROM "WhatsappAuthState" WHERE chave = ${key}`;
    if (!row) return null;
    try {
      return JSON.parse(row.valor, BufferJSON.reviver);
    } catch {
      return null;
    }
  };

  const writeData = async (key: string, data: unknown) => {
    const valor = JSON.stringify(data, BufferJSON.replacer);
    await sql`
      INSERT INTO "WhatsappAuthState" (chave, valor, "updatedAt")
      VALUES (${key}, ${valor}, NOW())
      ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, "updatedAt" = NOW()
    `;
  };

  const removeData = async (key: string) => {
    await sql`DELETE FROM "WhatsappAuthState" WHERE chave = ${key}`;
  };

  const creds = (await readData("creds")) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type: string, ids: string[]) => {
          const data: Record<string, any> = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === "app-state-sync-key" && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data: Record<string, Record<string, unknown>>) => {
          const tasks: Promise<void>[] = [];
          for (const categoria in data) {
            for (const id in data[categoria]) {
              const value = data[categoria][id];
              const key = `${categoria}-${id}`;
              tasks.push(value ? writeData(key, value) : removeData(key));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: async () => {
      await writeData("creds", creds);
    },
  };
}

// Usado pra saber, sem conectar, se já existe uma sessão pareada — evita mostrar
// QR code de novo à toa se a sessão já estiver salva.
export async function temSessaoPareada(sql: Sql): Promise<boolean> {
  await ensureWhatsappAuthTable(sql);
  const [row] = await sql`SELECT 1 FROM "WhatsappAuthState" WHERE chave = 'creds'`;
  return !!row;
}
