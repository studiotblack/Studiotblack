"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Scissors, LayoutDashboard, CalendarDays, Users, Wrench,
  Package, DollarSign, UserCheck, BarChart3, Settings,
  LogOut, ChevronRight, X, Shield, Menu, TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

const navItems = [
  { href: "/dashboard",     icon: LayoutDashboard, label: "Dashboard"      },
  { href: "/agenda",        icon: CalendarDays,    label: "Agenda"         },
  { href: "/clientes",      icon: Users,           label: "Clientes"       },
  { href: "/servicos",      icon: Scissors,        label: "Serviços"       },
  { href: "/produtos",      icon: Package,         label: "Produtos"       },
  { href: "/financeiro",    icon: DollarSign,      label: "Financeiro"     },
  { href: "/performance",   icon: TrendingUp,      label: "Performance"    },
  { href: "/colaboradores", icon: UserCheck,       label: "Colaboradores"  },
  { href: "/relatorios",    icon: BarChart3,       label: "Relatórios"     },
  { href: "/configuracoes", icon: Settings,        label: "Configurações"  },
];

const roleBadgeStyle: Record<string, { bg: string; color: string }> = {
  Admin:           { bg: "rgba(212,175,140,0.2)", color: "#d4af8c" },
  "Barbeiro Senior": { bg: "rgba(52,152,219,0.15)", color: "#3498db" },
  Barbeiro:        { bg: "rgba(52,152,219,0.15)", color: "#3498db" },
  Aprendiz:        { bg: "rgba(46,204,113,0.15)", color: "#2ecc71" },
};

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { usuarioAtivo, temPermissao } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(true);

  const visibleItems = navItems.filter(item => temPermissao(item.href));
  const badge = roleBadgeStyle[usuarioAtivo.cargo] ?? { bg: "rgba(155,89,182,0.15)", color: "#c39bd3" };

  const SidebarContent = ({ collapsed }: { collapsed?: boolean }) => (
    <div style={{
      width: collapsed ? 80 : 240, height: "100vh", display: "flex", flexDirection: "column",
      background: "var(--color-surface)", borderRight: "1px solid var(--color-border)",
      position: "absolute", top: 0, left: 0, transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease",
      overflow: "hidden", whiteSpace: "nowrap", zIndex: 50,
      boxShadow: collapsed ? "none" : "4px 0 24px rgba(0,0,0,0.5)",
    }}>
      {/* Logo */}
      <div style={{ padding: "1.5rem 1.25rem 1rem", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", width: "100%" }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "linear-gradient(135deg, #d4af8c, #a88660)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 0 16px rgba(212,175,140,0.25)",
            transition: "margin 0.3s ease",
          }}>
            <Scissors size={18} color="#1a0f10" strokeWidth={2.5} />
          </div>
          <div style={{ 
            opacity: collapsed ? 0 : 1, 
            transform: collapsed ? "translateX(-10px)" : "translateX(0)",
            transition: "opacity 0.3s, transform 0.3s",
            visibility: collapsed ? "hidden" : "visible",
          }}>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--color-cream)", lineHeight: 1.2 }}>
              Black Gestão
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--color-gold-dim)" }}>
              Studio T' Black
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "0.75rem", overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", justifyContent: "center", gap: "2px" }}>
        <div style={{ 
          fontSize: "0.65rem", color: "var(--color-muted-2)", textTransform: "uppercase", letterSpacing: "0.08em", 
          padding: "0.5rem 0.875rem 0.5rem", fontWeight: 600,
          opacity: collapsed ? 0 : 1, transition: "opacity 0.3s",
        }}>
          {collapsed ? "\u00A0" : "Menu Principal"}
        </div>
        {visibleItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link key={href} href={href} className={`sidebar-item ${active ? "active" : ""}`}
              onClick={onMobileClose} title={collapsed ? label : undefined} 
              style={{ padding: "0.625rem 0.875rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 24, flexShrink: 0 }}>
                <Icon size={18} strokeWidth={active ? 2 : 1.75} />
              </div>
              <span style={{ 
                flex: 1, 
                opacity: collapsed ? 0 : 1, 
                transition: "opacity 0.3s",
                visibility: collapsed ? "hidden" : "visible",
              }}>{label}</span>
              <div style={{
                opacity: collapsed ? 0 : 1, 
                transition: "opacity 0.3s",
                visibility: collapsed ? "hidden" : "visible",
              }}>
                {active && <ChevronRight size={14} style={{ opacity: 0.6 }} />}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div style={{ padding: "0.75rem", borderTop: "1px solid var(--color-border)", display: "flex", flexDirection: "column" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "0.75rem",
          padding: "0.625rem 0.75rem", borderRadius: "0.625rem",
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-border)",
          marginBottom: "0.5rem",
        }}>
          <div className="avatar avatar-sm" style={{ background: `linear-gradient(135deg, ${usuarioAtivo.cor}, #7a6040)`, flexShrink: 0 }}>
            {usuarioAtivo.nome.charAt(0)}
          </div>
          <div style={{ 
            flex: 1, minWidth: 0,
            opacity: collapsed ? 0 : 1, 
            transition: "opacity 0.3s",
            visibility: collapsed ? "hidden" : "visible",
          }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-cream)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {usuarioAtivo.nome}
            </div>
            <span style={{
              display: "inline-block", fontSize: "0.6rem", fontWeight: 600,
              padding: "1px 6px", borderRadius: 999,
              background: badge.bg, color: badge.color,
              border: `1px solid ${badge.color}40`,
              letterSpacing: "0.04em", textTransform: "uppercase",
              marginTop: 2,
            }}>
              {usuarioAtivo.isAdmin ? <><Shield size={8} style={{ display: "inline", marginRight: 3 }} />Admin</> : usuarioAtivo.cargo}
            </span>
          </div>
        </div>
        <Link href="/" className="sidebar-item" style={{ padding: "0.625rem 0.875rem", display: "flex", alignItems: "center", gap: "0.75rem" }} title={collapsed ? "Sair" : undefined}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 24, flexShrink: 0 }}>
            <LogOut size={16} />
          </div>
          <span style={{ 
            opacity: collapsed ? 0 : 1, 
            transition: "opacity 0.3s",
            visibility: collapsed ? "hidden" : "visible",
          }}>Sair</span>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — hidden on mobile via CSS */}
      <div 
        className="sidebar-desktop" 
        style={{ position: "relative", width: 80, height: "100vh", zIndex: 50 }}
        onMouseEnter={() => setIsCollapsed(false)}
        onMouseLeave={() => setIsCollapsed(true)}
      >
        <SidebarContent collapsed={isCollapsed} />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex" }}>
          <div
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
            onClick={onMobileClose}
          />
          <div style={{ position: "relative", zIndex: 1 }}>
            <SidebarContent collapsed={false} />
            <button
              onClick={onMobileClose}
              style={{
                position: "absolute", top: "1rem", right: "-3rem",
                background: "var(--color-surface)", border: "1px solid var(--color-border)",
                borderRadius: "0.5rem", padding: "0.5rem",
                color: "var(--color-cream)", cursor: "pointer",
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
