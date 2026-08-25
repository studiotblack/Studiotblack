"use client";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Search, CalendarDays, Clock, Menu, Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "@/lib/theme-context";
import type { Agendamento } from "@/lib/financeiro-data";
import { estaNestaSemana, statusAgendamento } from "@/lib/financeiro-data";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
  const router = useRouter();
  const page = pageTitles[pathname] ?? { title: "Black Gestão", subtitle: "" };
  const [now, setNow] = useState(new Date());
  const [showNotif, setShowNotif] = useState(false);
  const [contasPagar, setContasPagar] = useState<Agendamento[]>([]);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Notificações reais de Contas a Pagar — recalcula sempre que o header monta (troca de
  // página) ou o sino é aberto, e reflete a situação atual sozinho, sem precisar de um job
  // agendado rodando nem de dados fictícios.
  useEffect(() => {
    fetch("/api/financeiro/agendamentos?tipo=pagar")
      .then(r => r.ok ? r.json() : [])
      .then((rows: Agendamento[]) => setContasPagar(rows))
      .catch(() => {});
  }, [pathname, showNotif]);

  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  const vencidas = contasPagar.filter(a => statusAgendamento(a) === "vencido");
  const totalVencidas = vencidas.reduce((acc, a) => acc + (a.valor - a.valorPago), 0);

  // "Esta semana" já inclui vencidas em aberto (ver estaNestaSemana) — exclui aqui pra não
  // duplicar com a notificação de vencidas acima.
  const estaSemana = contasPagar.filter(a => statusAgendamento(a) !== "vencido" && estaNestaSemana(a));
  const totalEstaSemana = estaSemana.reduce((acc, a) => acc + (a.valor - a.valorPago), 0);

  const notificacoes = [
    ...(vencidas.length > 0 ? [{
      id: "contas-vencidas",
      tipo: "alerta" as const,
      msg: `${vencidas.length} conta${vencidas.length !== 1 ? "s" : ""} a pagar vencida${vencidas.length !== 1 ? "s" : ""} — total ${brl(totalVencidas)}`,
      tempo: "Atrasado",
      onClick: () => router.push("/financeiro"),
    }] : []),
    ...(estaSemana.length > 0 ? [{
      id: "contas-semana",
      tipo: "financeiro" as const,
      msg: `${estaSemana.length} conta${estaSemana.length !== 1 ? "s" : ""} a pagar esta semana — total ${brl(totalEstaSemana)}`,
      tempo: "Esta semana",
      onClick: () => router.push("/financeiro"),
    }] : []),
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
            {notificacoes.length > 0 && (
              <span style={{
                position: "absolute", top: 6, right: 6,
                width: 8, height: 8, borderRadius: "50%",
                background: vencidas.length > 0 ? "var(--color-danger)" : "var(--color-gold)",
                border: "2px solid var(--color-surface)",
              }} />
            )}
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
                {notificacoes.length === 0 && (
                  <p style={{ padding: "1.5rem 0.875rem", textAlign: "center", fontSize: "0.8125rem", color: "var(--color-muted)" }}>
                    Nenhuma pendência no momento.
                  </p>
                )}
                {notificacoes.map(n => (
                  <div key={n.id} style={{
                    padding: "0.75rem 0.875rem",
                    borderRadius: "0.5rem",
                    display: "flex", gap: "0.75rem",
                    alignItems: "flex-start",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                    onClick={"onClick" in n ? n.onClick : undefined}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--color-surface-2)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ fontSize: "1rem", flexShrink: 0 }}>
                      {n.tipo === "alerta" ? "⚠️" : "💰"}
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
                <button
                  onClick={() => { setShowNotif(false); router.push("/financeiro"); }}
                  style={{ fontSize: "0.8125rem", color: "var(--color-gold)", background: "none", border: "none", cursor: "pointer" }}
                >
                  Ver Contas a Pagar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
