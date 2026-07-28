import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const rotasPublicas = ["/", "/api/auth/login"];

const EXTENSOES_ESTATICAS = /\.(png|jpg|jpeg|svg|ico|css|js)
$
/;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isRotaPublica = rotasPublicas.includes(pathname);
  const isArquivoEstatico =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    EXTENSOES_ESTATICAS.test(pathname);

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
  matcher: ["/((?!api/auth/login|_next/static|_next/image|favicon.ico).*)"],
};
