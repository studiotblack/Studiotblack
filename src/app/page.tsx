"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scissors, Eye, EyeOff, Lock, Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("admin@blackgestao.com");
  const [password, setPassword] = useState("black2024");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    router.push("/dashboard");
  };

  return (
    <div
      className="min-h-screen flex"
      style={{ background: "var(--color-bg)" }}
    >
      {/* Left panel — branding */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #160f10 0%, #1e1516 50%, #271a1b 100%)",
          borderRight: "1px solid var(--color-border)",
        }}
      >
        {/* Background decoration */}
        <div style={{
          position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none"
        }}>
          <div style={{
            position: "absolute", width: 500, height: 500,
            borderRadius: "50%", top: -100, left: -100,
            background: "radial-gradient(circle, rgba(212,175,140,0.06) 0%, transparent 70%)"
          }} />
          <div style={{
            position: "absolute", width: 400, height: 400,
            borderRadius: "50%", bottom: -80, right: -80,
            background: "radial-gradient(circle, rgba(212,175,140,0.04) 0%, transparent 70%)"
          }} />
          {/* Grid pattern */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: `
              linear-gradient(rgba(212,175,140,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(212,175,140,0.03) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px"
          }} />
        </div>

        <div className="relative z-10 text-center">
          {/* Logo */}
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "linear-gradient(135deg, #d4af8c, #a88660)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 2rem",
            boxShadow: "0 0 40px rgba(212,175,140,0.3), 0 0 80px rgba(212,175,140,0.1)"
          }}>
            <Scissors size={36} color="#1a0f10" strokeWidth={2.5} />
          </div>

          <h1 style={{
            fontSize: "2.5rem", fontWeight: 800, lineHeight: 1.1,
            marginBottom: "1rem",
            background: "linear-gradient(135deg, #fff6e9 0%, #d4af8c 50%, #e8c99e 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Black Gestão
          </h1>
          <p style={{ color: "var(--color-gold-dim)", fontSize: "1.125rem", marginBottom: "3rem" }}>
            Studio T' Black
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", textAlign: "left" }}>
            {[
              { emoji: "📅", text: "Agenda inteligente multi-colaborador" },
              { emoji: "👥", text: "Gestão completa de clientes" },
              { emoji: "📦", text: "Controle de estoque e produtos" },
              { emoji: "💰", text: "Financeiro com integração bancária" },
              { emoji: "📊", text: "Relatórios e análises avançadas" },
            ].map((item, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: "0.875rem",
                padding: "0.75rem 1rem",
                background: "rgba(212,175,140,0.06)",
                border: "1px solid rgba(212,175,140,0.12)",
                borderRadius: "0.75rem",
              }}>
                <span style={{ fontSize: "1.25rem" }}>{item.emoji}</span>
                <span style={{ color: "var(--color-cream-dim)", fontSize: "0.9rem" }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div style={{ width: "100%", maxWidth: 420 }} className="animate-fadeIn">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "linear-gradient(135deg, #d4af8c, #a88660)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Scissors size={22} color="#1a0f10" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.25rem", color: "var(--color-cream)" }}>Black Gestão</div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-gold-dim)" }}>Studio T' Black</div>
            </div>
          </div>

          <div style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "1.875rem", fontWeight: 700, color: "var(--color-cream)", marginBottom: "0.375rem" }}>
              Bem-vindo de volta
            </h2>
            <p style={{ color: "var(--color-muted)", fontSize: "0.9rem" }}>
              Faça login para acessar o painel de gestão
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Email */}
            <div>
              <label className="form-label">E-mail</label>
              <div style={{ position: "relative" }}>
                <Mail
                  size={16} color="var(--color-muted)"
                  style={{ position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  style={{ paddingLeft: "2.5rem" }}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="form-label">Senha</label>
              <div style={{ position: "relative" }}>
                <Lock
                  size={16} color="var(--color-muted)"
                  style={{ position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ paddingLeft: "2.5rem", paddingRight: "2.75rem" }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute", right: "0.875rem", top: "50%",
                    transform: "translateY(-50%)", background: "none",
                    border: "none", cursor: "pointer", padding: 0,
                    color: "var(--color-muted)",
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-gold btn-lg"
              style={{ marginTop: "0.5rem", opacity: loading ? 0.8 : 1 }}
            >
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                  Entrando...
                </span>
              ) : (
                "Acessar o Sistema"
              )}
            </button>
          </form>

          {/* Hint */}
          <div style={{
            marginTop: "2rem", padding: "1rem",
            background: "rgba(212,175,140,0.06)",
            border: "1px solid rgba(212,175,140,0.12)",
            borderRadius: "0.75rem",
          }}>
            <p style={{ fontSize: "0.8125rem", color: "var(--color-gold-dim)", marginBottom: "0.375rem", fontWeight: 600 }}>
              🔑 Acesso demonstração:
            </p>
            <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)" }}>
              admin@blackgestao.com / black2024
            </p>
          </div>

          <p style={{ marginTop: "2rem", textAlign: "center", fontSize: "0.8125rem", color: "var(--color-muted-2)" }}>
            Black Gestão © {new Date().getFullYear()} — Studio T' Black
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
