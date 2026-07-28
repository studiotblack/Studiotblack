"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DollarSign, CalendarDays, Users, Menu as MenuIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const bottomItems = [
  { href: "/financeiro",  icon: DollarSign,   label: "Caixa"    },
  { href: "/agenda",      icon: CalendarDays, label: "Agenda"   },
  { href: "/clientes",    icon: Users,        label: "Clientes" },
];

export default function MobileBottomNav({ onMenuOpen }: { onMenuOpen: () => void }) {
  const pathname = usePathname();
  const { usuarioAtivo, temPermissao } = useAuth();
  const visibleItems = bottomItems.filter(i => temPermissao(i.href));

  return (
    <nav style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 55,
      background: "var(--color-surface)",
      borderTop: "1px solid var(--color-border)",
      alignItems: "center",
      justifyContent: "space-around",
      padding: "0.5rem 0 calc(0.5rem + env(safe-area-inset-bottom))",
      backdropFilter: "blur(16px)",
    }} className="mobile-bottom-nav">
      {visibleItems.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || pathname.startsWith(href);
        return (
          <Link key={href} href={href} style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "2px",
            padding: "0.375rem 1rem",
            borderRadius: "0.75rem",
            textDecoration: "none",
            transition: "all 0.2s",
            color: active ? "#fff" : "var(--color-muted)",
            background: active ? "var(--color-surface-3)" : "transparent",
            position: "relative",
          }}>
            {active && (
              <span style={{
                position: "absolute",
                top: "-1px",
                left: "50%",
                transform: "translateX(-50%)",
                width: 32,
                height: 3,
                borderRadius: "0 0 4px 4px",
                background: "var(--color-gold)",
              }} />
            )}
            <div style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: active
                ? "linear-gradient(135deg, var(--color-gold), var(--color-gold-dim))"
                : "transparent",
              transition: "all 0.2s",
            }}>
              <Icon size={20} color={active ? "#1a0f10" : "var(--color-muted)"} strokeWidth={active ? 2.5 : 1.75} />
            </div>
            <span style={{
              fontSize: "0.65rem",
              fontWeight: active ? 600 : 400,
              color: active ? "var(--color-gold)" : "var(--color-muted)",
              letterSpacing: "0.02em",
            }}>{label}</span>
          </Link>
        );
      })}

      {/* Menu button */}
      <button
        onClick={onMenuOpen}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "2px",
          padding: "0.375rem 1rem",
          borderRadius: "0.75rem",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--color-muted)",
          position: "relative",
        }}
      >
        <div style={{
          width: 42,
          height: 42,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--color-surface-2)",
          border: "2px solid",
          borderColor: "var(--color-gold-dark)",
          overflow: "hidden",
        }}>
          <span style={{
            fontWeight: 700,
            fontSize: "1rem",
            color: "var(--color-gold)",
          }}>
            {usuarioAtivo.nome.charAt(0)}
          </span>
        </div>
        <span style={{ fontSize: "0.65rem", fontWeight: 400, color: "var(--color-muted)", letterSpacing: "0.02em" }}>
          Menu
        </span>
      </button>
    </nav>
  );
}
