"use client";
import { usePathname } from "next/navigation";
import { Bell, Search, CalendarDays, Clock, Menu, Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "@/lib/theme-context";

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard":     { title: "Dashboard",       subtitle: "Visão geral do negócio"               },
  "/agenda":        { title: "Agenda",           subtitle: "Gestão de agendamentos"               },
  "/clientes":      { title: "Clientes",         subtitle: "Cadastro e histórico de clientes"     },
  "/servicos":      { title: "Serviços",         subtitle: "Catálogo de serviços"                 },
  "/produtos":      { title: "Produtos",         subtitle: "Estoque e inventário"                 },
  "/financeiro":    { title: "Financeiro",       subtitle: "Fluxo de caixa e integração bancária" },
  "/colaboradores": { title: "Colaboradores",    subtitle: "Equipe, horários e comissões"         },
  "/relatorios":    { title: "Relatórios",       subtitle: "Análises e gráficos"                  },
  "/configuracoes": { title: "Configurações",    subtitle: "Configurações do sistema"             },
};

export default function Header({ onMobileMenuOpen }: { onMobileMenuOpen?: () => void }) {
  const pathname = usePathname();
  const page = pageTitles[pathname] ?? { title: "Black Gestão", subtitle: "" };
  const [now, setNow] = useState(new Date());
  const [showNotif, setShowNotif] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  const notificacoes = [
    { id: 1, tipo: "agenda",  msg: "Eduardo Pereira em 15 min — Corte + Barba",  tempo: "15 min" },
    { id: 2, tipo: "estoque", msg: "Estoque baixo: Shampoo Anti-Resíduo (8 un)", tempo: "Agora"  },
    { id: 3, tipo: "estoque", msg: "Estoque baixo: Talco Antisséptico (4 un)",   tempo: "Agora"  },
    { id: 4, tipo: "agenda",  msg: "Igor Alves confirmou agendamento 10:00",      tempo: "2 min"  },
  ];

  return (
    <header style={{
      background: "var(--color-surface)",
      borderBottom: "1px solid var(--color-border)",
      padding: "0 1rem",
      height: 64,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "1rem",
      position: "sticky",
      top: 0,
      zIndex: 40,
    }}>
      {/* Mobile menu button + page title */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {/* Mobile hamburger — visible on mobile only */}
        <button
          className="mobile-menu-btn"
          onClick={onMobileMenuOpen}
          style={{
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            borderRadius: "0.5rem",
            padding: "0.5rem",
            color: "var(--color-cream)",
            cursor: "pointer",
            display: "none", // shown via CSS on mobile
          }}
        >
          <Menu size={20} />
        </button>

        <div>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--color-cream)", lineHeight: 1.1 }}>
            {page.title}
          </h1>
          <p style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginTop: 1 }} className="header-subtitle">
            {page.subtitle}
          </p>
        </div>
      </div>

      {/* Right: search + date + notifs */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {/* Search — hidden on mobile */}
        <div className="header-search" style={{ position: "relative" }}>
          <Search size={14} color="var(--color-muted)"
            style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input
            type="search"
            placeholder="Buscar cliente, serviço..."
            className="search-input"
            style={{ width: 220, fontSize: "0.8rem" }}
          />
        </div>

        {/* Date / Time — hidden on mobile */}
        <div className="header-datetime" style={{
          display: "flex", alignItems: "center", gap: "0.5rem",
          padding: "0.375rem 0.75rem",
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-border)",
          borderRadius: "0.5rem",
        }}>
          <CalendarDays size={13} color="var(--color-gold)" />
          <span style={{ fontSize: "0.75rem", color: "var(--color-cream-dim)", textTransform: "capitalize" }}>
            {dateStr}
          </span>
          <span style={{ color: "var(--color-border-light)" }}>·</span>
          <Clock size={13} color="var(--color-gold)" />
          <span style={{ fontSize: "0.75rem", color: "var(--color-gold)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {timeStr}
          </span>
        </div>

        {/* Alternar tema claro/escuro */}
        <button
          onClick={toggleTheme}
          title={theme === "dark" ? "Mudar para tela clara" : "Mudar para tela escura"}
          style={{
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            borderRadius: "0.5rem",
            padding: "0.5rem",
            cursor: "pointer",
            color: "var(--color-gold)",
            display: "flex", alignItems: "center",
            transition: "border-color 0.2s",
          }}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowNotif(!showNotif)}
            style={{
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              borderRadius: "0.5rem",
              padding: "0.5rem",
              cursor: "pointer",
              color: "var(--color-cream-dim)",
              display: "flex", alignItems: "center",
              position: "relative",
              transition: "border-color 0.2s",
            }}
          >
            <Bell size={18} />
            <span style={{
              position: "absolute", top: 6, right: 6,
              width: 8, height: 8, borderRadius: "50%",
              background: "var(--color-gold)",
              border: "2px solid var(--color-surface)",
            }} />
          </button>

          {showNotif && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", right: 0,
              width: 300, background: "var(--color-surface-3)",
              border: "1px solid var(--color-border-light)",
              borderRadius: "0.875rem",
              boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
              zIndex: 100,
              animation: "slideUp 0.15s ease",
            }}>
              <div style={{
                padding: "1rem 1.25rem 0.75rem",
                borderBottom: "1px solid var(--color-border)",
                display: "flex", alignItems: "center", justifyContent: "space-between"
              }}>
                <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--color-cream)" }}>
                  Notificações
                </span>
                <span className="badge badge-gold">{notificacoes.length}</span>
              </div>
              <div style={{ padding: "0.5rem" }}>
                {notificacoes.map(n => (
                  <div key={n.id} style={{
                    padding: "0.75rem 0.875rem",
                    borderRadius: "0.5rem",
                    display: "flex", gap: "0.75rem",
                    alignItems: "flex-start",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--color-surface-2)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ fontSize: "1rem", flexShrink: 0 }}>
                      {n.tipo === "agenda" ? "📅" : "📦"}
                    </span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: "0.8125rem", color: "var(--color-cream-dim)", lineHeight: 1.4 }}>
                        {n.msg}
                      </p>
                      <p style={{ fontSize: "0.7rem", color: "var(--color-muted)", marginTop: 2 }}>
                        {n.tempo}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding: "0.75rem", borderTop: "1px solid var(--color-border)", textAlign: "center" }}>
                <button style={{ fontSize: "0.8125rem", color: "var(--color-gold)", background: "none", border: "none", cursor: "pointer" }}>
                  Ver todas
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
