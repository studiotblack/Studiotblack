"use client";

import React from "react";
import type { DreLinhaImportada } from "@/lib/dre-data";
import { MESES_ABREV, isDreLinhaDetalhe } from "@/lib/dre-data";

interface DRETableProps {
  linhas: DreLinhaImportada[];
  ano: number;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

function cellColor(v: number) {
  if (v === 0) return "var(--color-muted)";
  return v > 0 ? "var(--color-success)" : "var(--color-danger)";
}

// Linhas de resultado que merecem destaque forte, como no rodapé de um DRE impresso
const DESTAQUES = new Set(["RESULTADO OPERACIONAL", "VARIAÇÃO DE CAIXA", "Margem de contribuição"]);

export default function DRETable({ linhas, ano }: DRETableProps) {
  const thStyle: React.CSSProperties = {
    padding: "0.5rem 0.625rem", fontSize: "0.7rem", fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.05em",
    color: "var(--color-muted)", whiteSpace: "nowrap",
    background: "var(--color-surface-2)", position: "sticky", top: 0, zIndex: 2,
    borderBottom: "1px solid var(--color-border)",
  };

  const labelThStyle: React.CSSProperties = {
    ...thStyle, textAlign: "left", position: "sticky", left: 0, zIndex: 3,
    minWidth: 280, maxWidth: 340,
  };

  const headerRowStyle: React.CSSProperties = {
    padding: "0.625rem 0.75rem",
    background: "var(--color-surface-3)",
    fontWeight: 700, fontSize: "0.8rem",
    color: "var(--color-gold)",
    whiteSpace: "nowrap",
    position: "sticky", left: 0,
  };

  const detalheRowStyle: React.CSSProperties = {
    padding: "0.5rem 0.75rem 0.5rem 1.75rem",
    fontSize: "0.8rem", color: "var(--color-cream-dim)",
    whiteSpace: "nowrap",
    position: "sticky", left: 0,
    background: "var(--color-surface)",
    display: "flex", alignItems: "center",
  };

  const destaqueRowStyle: React.CSSProperties = {
    padding: "0.7rem 0.75rem",
    fontWeight: 800, fontSize: "0.85rem",
    color: "var(--color-gold-bright)",
    background: "rgba(212,175,140,0.12)",
    whiteSpace: "nowrap",
    position: "sticky", left: 0,
  };

  const cellStyle: React.CSSProperties = {
    padding: "0.5rem 0.625rem", textAlign: "right", fontSize: "0.8rem", whiteSpace: "nowrap",
  };

  if (linhas.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "3rem 2rem", color: "var(--color-muted)" }}>
        <p style={{ marginBottom: "0.5rem" }}>Nenhum DRE importado ainda para {ano}.</p>
        <p style={{ fontSize: "0.85rem" }}>
          Exporte o relatório &quot;Realizado&quot; do seu sistema contábil e salve em{" "}
          <strong style={{ color: "var(--color-cream)" }}>Downloads/AppBarber Financeiro</strong> — a importação é automática.
        </p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto", borderRadius: "0.875rem", border: "1px solid var(--color-border)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1200 }}>
        <thead>
          <tr>
            <th style={labelThStyle}>Descrição</th>
            {MESES_ABREV.map((m, i) => (
              <th key={i} style={{ ...thStyle, textAlign: "right", minWidth: 90 }}>{m}</th>
            ))}
            <th style={{ ...thStyle, textAlign: "right", minWidth: 120, borderLeft: "1px solid var(--color-border)", color: "var(--color-gold)" }}>
              Total {ano}
            </th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, idx) => {
            const isPct = l.resultado.trim() === "%";
            const isDetalhe = isDreLinhaDetalhe(l.resultado);
            const isDestaque = DESTAQUES.has(l.resultado);
            const rowStyle = isDestaque ? destaqueRowStyle : (isDetalhe ? detalheRowStyle : headerRowStyle);
            const valores = [l.jan, l.fev, l.mar, l.abr, l.mai, l.jun, l.jul, l.ago, l.set, l.out, l.nov, l.dez];
            const format = isPct ? fmtPct : fmt;
            const rowBg = isDestaque ? "rgba(212,175,140,0.08)" : undefined;

            return (
              <tr key={idx} style={{ borderTop: isDestaque ? "2px solid var(--color-border)" : undefined, borderBottom: "1px solid var(--color-border)" }}>
                <td style={{ padding: 0, position: "sticky", left: 0, background: rowStyle.background }}>
                  <div style={rowStyle} title={l.resultado}>
                    {isDetalhe && <span style={{ color: "var(--color-border-light)", marginRight: 6 }}>└</span>}
                    {l.resultado}
                  </div>
                </td>
                {valores.map((v, i) => (
                  <td key={i} style={{ ...cellStyle, background: rowBg }}>
                    <span style={{ color: isPct ? "var(--color-info)" : cellColor(v), fontWeight: isDestaque ? 700 : undefined }}>
                      {(v !== 0 || isPct) ? format(v) : "—"}
                    </span>
                  </td>
                ))}
                <td style={{ ...cellStyle, borderLeft: "1px solid var(--color-border)", background: rowBg }}>
                  <span style={{ color: isPct ? "var(--color-info)" : cellColor(l.totalAno), fontWeight: 700 }}>
                    {format(l.totalAno)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
