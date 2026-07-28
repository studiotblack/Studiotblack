/**
 * Cliente de integração com a API do Sicoob via mTLS
 * Adaptado de: finance-dashboard/src/lib/bank/sicoob-client.ts
 * Usado exclusivamente em API Routes (servidor Node.js)
 */
import https from "https";
import qs from "querystring";

export class SicoobClient {
  private clientId: string;
  private cert: string;
  private key: string;

  constructor(clientId: string, cert: string, key: string) {
    this.clientId = clientId;
    // Normaliza quebras de linha que podem vir escaped de variáveis de ambiente
    this.cert = cert.includes("-----BEGIN") ? cert : cert.replace(/\\n/g, "\n");
    this.key  = key.includes("-----BEGIN")  ? key  : key.replace(/\\n/g, "\n");
  }

  private async request(options: https.RequestOptions, body?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestOptions: https.RequestOptions = {
        ...options,
        cert: this.cert,
        key: this.key,
        minVersion: "TLSv1.2",
        rejectUnauthorized: false,
        headers: {
          ...options.headers,
          client_id: this.clientId,
        },
      };

      const req = https.request(requestOptions, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve(data);
            }
          } else {
            reject(new Error(`Erro HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on("error", (e) => reject(e));
      if (body) req.write(body);
      req.end();
    });
  }

  async getToken(): Promise<string> {
    const body = qs.stringify({
      grant_type: "client_credentials",
      client_id: this.clientId,
      scope: "cco_consulta",
    });

    const result = await this.request(
      {
        hostname: "auth.sicoob.com.br",
        path: "/auth/realms/cooperado/protocol/openid-connect/token",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      body
    );

    return result.access_token;
  }

  async getExtrato(
    accountNumber: string,
    mes: number,
    ano: number
  ): Promise<any> {
    const token = await this.getToken();
    const cleanAccount = accountNumber.replace(/\D/g, "");
    const diaInicial = 1;
    const diaFinal = new Date(ano, mes, 0).getDate();

    return await this.request({
      hostname: "api.sicoob.com.br",
      path: `/conta-corrente/v4/extrato/${mes}/${ano}?diaInicial=${diaInicial}&diaFinal=${diaFinal}&numeroContaCorrente=${cleanAccount}`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
  }

  async getSaldo(accountNumber: string): Promise<any> {
    const token = await this.getToken();
    const cleanAccount = accountNumber.replace(/\D/g, "");

    return await this.request({
      hostname: "api.sicoob.com.br",
      path: `/conta-corrente/v4/saldo?numeroContaCorrente=${cleanAccount}`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
  }
}
