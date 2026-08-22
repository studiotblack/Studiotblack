"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import type { DreLinhaImportada } from "@/lib/dre-data";
import { MESES_ABREV, MESES_FULL, isDreLinhaDetalhe } from "@/lib/dre-data";
import DreDetalheModal from "./DreDetalheModal";

// Extrai o código contábil do início do nome da linha (ex: "1.1.1.01.001-Venda de Serviços" -> "1.1.1.01.001")
const extrairCodigo = (resultado: string): string | null => {
  const m = resultado.match(/^(\d[\d.]*\d|\d)-/);
  return m ? m[1] : null;
};

interface DRETableProps {
  linhas: DreLinhaImportada[];
  ano: number;
}

interface Bloco {
  header: DreLinhaImportada;
  detalhes: DreLinhaImportada[];
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
  // Agrupa cada cabeçalho com as contas de detalhe que vêm logo depois dele —
  // é essa estrutura que permite recolher/expandir por categoria.
  const blocos: Bloco[] = useMemo(() => {
    const resultado: Bloco[] = [];
    for (const linha of linhas) {
      if (!isDreLinhaDetalhe(linha.resultado)) {
        resultado.push({ header: linha, detalhes: [] });
      } else if (resultado.length > 0) {
        resultado[resultado.length - 1].detalhes.push(linha);
      }
    }
    return resultado;
  }, [linhas]);

  // Por padrão começa tudo recolhido (só os totais), igual ao seu sistema contábil
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());

  const toggleBloco = (ordem: number) => {
    setExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(ordem)) next.delete(ordem); else next.add(ordem);
      return next;
    });
  };

  const expandirTudo = () => setExpandidos(new Set(blocos.filter(b => b.detalhes.length > 0).map(b => b.header.ordem)));
  const recolherTudo = () => setExpandidos(new Set());

  const [detalheAlvo, setDetalheAlvo] = useState<{ codigo: string; nome: string; mes: number; ano: number; mesLabel: string; valorDre: number } | null>(null);

  const abrirDetalhe = (linha: DreLinhaImportada, mesIndex: number, valor: number) => {
    const codigo = extrairCodigo(linha.resultado);
    if (!codigo) return;
    setDetalheAlvo({ codigo, nome: linha.resultado, mes: mesIndex + 1, ano, mesLabel: MESES_FULL[mesIndex], valorDre: valor });
  };

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

  const headerRowStyle = (clickable: boolean): React.CSSProperties => ({
    padding: "0.625rem 0.75rem",
    background: "var(--color-surface-3)",
    fontWeight: 700, fontSize: "0.8rem",
    color: "var(--color-gold)",
    whiteSpace: "nowrap",
    position: "sticky", left: 0,
    display: "flex", alignItems: "center", gap: "0.4rem",
    cursor: clickable ? "pointer" : "default",
    userSelect: "none" as const,
  });

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

  const renderValueCells = (l: DreLinhaImportada, isPct: boolean, isDestaque: boolean, rowBg?: string) => {
    const valores = [l.jan, l.fev, l.mar, l.abr, l.mai, l.jun, l.jul, l.ago, l.set, l.out, l.nov, l.dez];
    const format = isPct ? fmtPct : fmt;
    const clicavel = !isPct && !!extrairCodigo(l.resultado);
    return (
      <>
        {valores.map((v, i) => (
          <td
            key={i}
            style={{ ...cellStyle, background: rowBg, cursor: clicavel ? "pointer" : undefined }}
            onClick={clicavel ? () => abrirDetalhe(l, i, v) : undefined}
            title={clicavel ? "Ver lançamentos que compõem esse valor" : undefined}
          >
            <span style={{ color: isPct ? "var(--color-info)" : cellColor(v), fontWeight: isDestaque ? 700 : undefined, textDecoration: clicavel ? "underline dotted" : undefined, textDecorationColor: clicavel ? "var(--color-border-light)" : undefined }}>
              {(v !== 0 || isPct) ? format(v) : "—"}
            </span>
          </td>
        ))}
        <td style={{ ...cellStyle, borderLeft: "1px solid var(--color-border)", background: rowBg }}>
          <span style={{ color: isPct ? "var(--color-info)" : cellColor(l.totalAno), fontWeight: 700 }}>
            {format(l.totalAno)}
          </span>
        </td>
      </>
    );
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
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
        <button className="btn btn-ghost btn-sm" onClick={expandirTudo}>
          <Maximize2 size={13} /> Expandir tudo
        </button>
        <button className="btn btn-ghost btn-sm" onClick={recolherTudo}>
          <Minimize2 size={13} /> Recolher tudo
        </button>
      </div>

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
            {blocos.map(bloco => {
              const { header, detalhes } = bloco;
              const isPct = header.resultado.trim() === "%";
              const isDestaque = DESTAQUES.has(header.resultado);
              const podeExpandir = detalhes.length > 0;
              const isExpandido = expandidos.has(header.ordem);
              const rowBg = isDestaque ? "rgba(212,175,140,0.08)" : undefined;

              return (
                <React.Fragment key={header.ordem}>
                  <tr style={{ borderTop: isDestaque ? "2px solid var(--color-border)" : undefined, borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: 0, position: "sticky", left: 0, background: isDestaque ? rowBg : undefined }}>
                      <div
                        style={isDestaque ? destaqueRowStyle : headerRowStyle(podeExpandir)}
                        title={header.resultado}
                        onClick={() => podeExpandir && toggleBloco(header.ordem)}
                      >
                        {podeExpandir && (isExpandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                        {header.resultado}
                        {podeExpandir && (
                          <span style={{ fontSize: "0.7rem", color: "var(--color-muted)", fontWeight: 500 }}>
                            ({detalhes.length})
                          </span>
                        )}
                      </div>
                    </td>
                    {renderValueCells(header, isPct, isDestaque, rowBg)}
                  </tr>

                  {isExpandido && detalhes.map((d, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--color-border)" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,175,140,0.04)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: 0, position: "sticky", left: 0 }}>
                        <div style={detalheRowStyle} title={d.resultado}>
                          <span style={{ color: "var(--color-border-light)", marginRight: 6 }}>└</span>
                          {d.resultado}
                        </div>
                      </td>
                      {renderValueCells(d, false, false)}
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <DreDetalheModal alvo={detalheAlvo} onClose={() => setDetalheAlvo(null)} />
    </div>
  );
}
