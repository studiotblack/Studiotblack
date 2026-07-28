"use client";

import { useEffect } from "react";
import { X, Landmark, Wallet, Plus } from "lucide-react";
import type { DRELancamento, DREGrupo } from "@/lib/dre-data";
import { getLancamentosByGroupSubcatMes, MESES_FULL } from "@/lib/dre-data";

interface LancamentosPanelProps {
  lancamentos: DRELancamento[];
  grupo: DREGrupo | null;
  subcategoria: string | null;
  mes: number | null; // 1-12
  onClose: () => void;
  onAddClick: () => void;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function LancamentosPanel({
  lancamentos, grupo, subcategoria, mes, onClose, onAddClick,
}: LancamentosPanelProps) {
  const isOpen = grupo !== null && subcategoria !== null && mes !== null;

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const items = isOpen
    ? getLancamentosByGroupSubcatMes(lancamentos, grupo!, subcategoria!, mes!)
    : [];

  const total = items.reduce((acc, l) => {
    if (l.grupo === "receita" && l.tipo === "SAIDA") return acc - l.valor;
    return acc + l.valor;
  }, 0);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(3px)", zIndex: 90,
          opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 0.25s",
        }}
      />

      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 420,
        maxWidth: "100vw",
        background: "var(--color-surface)",
        borderLeft: "1px solid var(--color-border-light)",
        zIndex: 91,
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
        display: "flex", flexDirection: "column",
        boxShadow: "-20px 0 60px rgba(0,0,0,0.4)",
      }}>
        {/* Header */}
        <div style={{
          padding: "1.25rem 1.5rem",
          borderBottom: "1px solid var(--color-border)",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: 0, color: "var(--color-gold)" }}>
              {subcategoria}
            </h2>
            <p style={{ fontSize: "0.75rem", color: "var(--color-muted)", margin: "2px 0 0 0" }}>
              {mes ? MESES_FULL[mes - 1] : ""} — {items.length} lançamento{items.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer", padding: "0.25rem" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Total */}
        <div style={{
          padding: "1rem 1.5rem",
          background: "var(--color-surface-2)",
          borderBottom: "1px solid var(--color-border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>Total do período</span>
          <span style={{
            fontSize: "1.125rem", fontWeight: 700,
            color: total >= 0 ? "var(--color-success)" : "var(--color-danger)",
          }}>
            {fmt(total)}
          </span>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem" }}>
          {items.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--color-muted)" }}>
              <p style={{ fontSize: "0.875rem" }}>Nenhum lançamento neste período.</p>
              <p style={{ fontSize: "0.75rem", marginTop: 4 }}>Clique em "Adicionar" para incluir.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {items.map(l => (
                <div key={l.id} style={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "0.625rem",
                  padding: "0.75rem 1rem",
                  display: "flex", flexDirection: "column", gap: "0.375rem",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-cream)", flex: 1, paddingRight: 8 }}>
                      {l.descricao}
                    </span>
                    <span style={{
                      fontSize: "0.9rem", fontWeight: 700, flexShrink: 0,
                      color: l.tipo === "ENTRADA" ? "var(--color-success)" : "var(--color-danger)",
                    }}>
                      {l.tipo === "ENTRADA" ? "+" : "-"}{fmt(l.valor)}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <span style={{ fontSize: "0.7rem", color: "var(--color-muted)" }}>
                      {new Date(l.data + "T12:00:00").toLocaleDateString("pt-BR")}
                    </span>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 3,
                      fontSize: "0.65rem", padding: "2px 6px", borderRadius: 999,
                      background: l.origem === "banco" ? "rgba(52,152,219,0.15)" : "rgba(46,204,113,0.12)",
                      color: l.origem === "banco" ? "var(--color-info)" : "var(--color-success)",
                      border: `1px solid ${l.origem === "banco" ? "var(--color-info)" : "var(--color-success)"}40`,
                    }}>
                      {l.origem === "banco" ? <Landmark size={9} /> : <Wallet size={9} />}
                      {l.origem === "banco" ? "Banco" : "Caixa"}
                    </span>
                    {l.importadoSicoob && (
                      <span style={{
                        fontSize: "0.6rem", padding: "2px 5px", borderRadius: 999,
                        background: "rgba(155,89,182,0.15)", color: "#9b59b6",
                        border: "1px solid #9b59b640",
                      }}>
                        Sicoob
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "1rem 1.5rem",
          borderTop: "1px solid var(--color-border)",
          flexShrink: 0,
        }}>
          <button className="btn btn-gold" style={{ width: "100%", justifyContent: "center" }} onClick={onAddClick}>
            <Plus size={16} /> Adicionar Lançamento
          </button>
        </div>
      </div>
    </>
  );
}
