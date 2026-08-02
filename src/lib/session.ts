import { NextRequest } from "next/server";

interface Sessao {
  id: string;
  email: string;
  name?: string;
  role: string;
}

export function getSessao(request: NextRequest): Sessao | null {
  const raw = request.cookies.get("sessao")?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Sessao;
  } catch {
    return null;
  }
}

export function isAdminRequest(request: NextRequest): boolean {
  return getSessao(request)?.role === "ADMIN";
}
