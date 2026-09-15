import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/cron/avisar-contas-pagar — chamado toda segunda de manhã (ver vercel.json) pelo
// Vercel Cron. Rota fina: só valida o CRON_SECRET e dispara o envio de verdade.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  const origem = new URL(request.url).origin;
  // Repassa o mesmo header — o middleware de sessão bloqueia qualquer /api/financeiro/*
  // sem cookie de login OU esse bearer (ver src/middleware.ts).
  const headersCron: Record<string, string> = cronSecret ? { authorization: `Bearer ${cronSecret}` } : {};
  try {
    const res = await fetch(`${origem}/api/financeiro/whatsapp/avisar-contas-pagar`, { method: "POST", headers: headersCron });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ executadoEm: new Date().toISOString(), ok: res.ok, ...data });
  } catch (err: any) {
    return NextResponse.json({ executadoEm: new Date().toISOString(), ok: false, error: err?.message }, { status: 500 });
  }
}
