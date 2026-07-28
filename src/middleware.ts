import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rotas que qualquer pessoa pode acessar, mesmo sem login
const rotasPublicas = ["/", "/api/auth/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isRotaPublica = rotasPublicas.includes(pathname);
  const isArquivoEstatico =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.(png|jpg|jpeg|svg|ico|css|js)
$
/.test(pathname);

  if (isRotaPublica || isArquivoEstatico) {
    return NextResponse.next();
  }

  const sessao = request.cookies.get("sessao");

  if (!sessao) {
    const loginUrl = new URL("/", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Aplica em tudo, EXCETO: login (api), arquivos internos do Next e estáticos
    "/((?!api/auth/login|_next/static|_next/image|favicon.ico).*)",
  ],
};
