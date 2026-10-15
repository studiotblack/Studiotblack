import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const rotasPublicas = ["/", "/api/auth/login"];

const EXTENSOES_ESTATICAS = [".png", ".jpg", ".jpeg", ".svg", ".ico", ".css", ".js"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Checkpoint semanal de compras da recepção: abre no celular sem login. Só estes dois
  // prefixos; a chave de acesso é o token longo na URL (validado dentro da rota).
  const isChecklistPublico =
    pathname.startsWith("/compras/lista/") || pathname.startsWith("/api/compras/publico/");

  const isRotaPublica = rotasPublicas.includes(pathname) || isChecklistPublico;
  const isArquivoEstatico =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    EXTENSOES_ESTATICAS.some(function (ext) {
      return pathname.endsWith(ext);
    });

  if (isRotaPublica || isArquivoEstatico) {
    return NextResponse.next();
  }

  const sessao = request.cookies.get("sessao");

  if (!sessao) {
    // Vercel Cron (e as chamadas internas que os cron routes fazem pras rotas de
    // /api/financeiro/*) nunca carregam o cookie de sessão do navegador — sem essa
    // exceção, TODO acesso automatizado (inclusive o cron diário já existente) cai no
    // redirect de login antes mesmo de chegar na checagem de CRON_SECRET dentro da rota.
    // Só libera quando o segredo bate exatamente — não abre acesso novo pra quem não
    // conhece o valor, e se CRON_SECRET não estiver configurado essa comparação nunca
    // passa (mesmo comportamento estrito de antes).
    const cronSecret = process.env.CRON_SECRET;
    const auth = request.headers.get("authorization");
    const ehChamadaDeCron = !!cronSecret && auth === `Bearer ${cronSecret}`;
    if (!ehChamadaDeCron) {
      const loginUrl = new URL("/", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth/login|_next/static|_next/image|favicon.ico).*)"],
};
