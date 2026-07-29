import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import postgres from "postgres";

export const dynamic = "force-dynamic";

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada");
  const isPooler = url.includes("pooler.supabase.com") || url.includes(":6543");
  return postgres(url, { ssl: "require", prepare: !isPooler });
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    // Fallback hardcoded para dev local sem banco configurado
    const { email, password } = await request.json();
    if (email === "admin@black.com" && password === "black2026") {
      const response = NextResponse.json({ success: true, user: { id: "1", email, name: "Admin", role: "ADMIN" } });
      response.cookies.set("sessao", JSON.stringify({ id: "1", email, name: "Admin", role: "ADMIN" }), {
        httpOnly: true, secure: false, sameSite: "lax", maxAge: 60 * 60 * 24 * 7, path: "/",
      });
      return response;
    }
    return NextResponse.json({ error: "Email ou senha inválidos" }, { status: 401 });
  }

  const sql = getDb();
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email e senha são obrigatórios" }, { status: 400 });
    }

    // Garante que a tabela User existe
    await sql`
      CREATE TABLE IF NOT EXISTS "User" (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        role TEXT NOT NULL DEFAULT 'COLLABORATOR',
        ativo BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;

    const rows = await sql`SELECT * FROM "User" WHERE email = ${email} LIMIT 1`;
    const user = rows[0];

    if (!user || !user.ativo) {
      return NextResponse.json({ error: "Email ou senha inválidos" }, { status: 401 });
    }

    const senhaCorreta = await bcrypt.compare(password, user.password);
    if (!senhaCorreta) {
      return NextResponse.json({ error: "Email ou senha inválidos" }, { status: 401 });
    }

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });

    response.cookies.set("sessao", JSON.stringify({
      id: user.id, email: user.email, name: user.name, role: user.role,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Erro no login:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
