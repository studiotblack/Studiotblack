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

export async function carregarAuthStatePostgres(sql: Sql) {
  await ensureWhatsappAuthTable(sql);

  // O pareamento fica minutos esperando o usuário escanear o QR com a mesma conexão
  // Postgres aberta o tempo todo — se o pooler (pgbouncer) derrubar essa conexão ociosa
  // no meio da espera, a próxima leitura/escrita falha. Sem o try/catch, esse erro não
  // tratado derrubava o processo inteiro bem na hora de salvar a sessão recém-pareada
  // (foi exatamente isso que corrompeu uma sessão antes) — melhor logar e seguir do que
  // perder tudo por causa de uma única query.
  const readData = async (key: string) => {
    try {
      const [row] = await sql`SELECT valor FROM "WhatsappAuthState" WHERE chave = ${key}`;
      if (!row) return null;
      return JSON.parse(row.valor, BufferJSON.reviver);
    } catch (err) {
      console.error(`[whatsapp-auth-state] falha ao ler "${key}":`, err);
      return null;
    }
  };

  const writeData = async (key: string, data: unknown) => {
    const valor = JSON.stringify(data, BufferJSON.replacer);
    try {
      await sql`
        INSERT INTO "WhatsappAuthState" (chave, valor, "updatedAt")
        VALUES (${key}, ${valor}, NOW())
        ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, "updatedAt" = NOW()
      `;
    } catch (err) {
      console.error(`[whatsapp-auth-state] falha ao salvar "${key}" (sessão pode ficar incompleta):`, err);
    }
  };

  const removeData = async (key: string) => {
    try {
      await sql`DELETE FROM "WhatsappAuthState" WHERE chave = ${key}`;
    } catch (err) {
      console.error(`[whatsapp-auth-state] falha ao remover "${key}":`, err);
    }
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
