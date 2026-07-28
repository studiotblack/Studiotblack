"use client";

import React, { useState, useMemo } from "react";
import {
  ChevronDown, ChevronRight, TrendingUp, TrendingDown,
  AlertTriangle, MinusSquare,
} from "lucide-react";
import type { DRELancamento, DREGrupo } from "@/lib/dre-data";
import {
  CATEGORIAS_DEFAULT, GRUPO_LABELS, MESES_ABREV,
  getTotalByGroupAndSubcat, getTotalByGroup, getTotalBySubSub,
  getLucroBruto, getResultadoOperacional, getVariacaoCaixa,
} from "@/lib/dre-data";

interface DRETableProps {
  lancamentos: DRELancamento[];
  anoFiltro: number;
  onCellClick: (grupo: DREGrupo, subcategoria: string, mes: number) => void;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function cellColor(v: number, isPositiveGood = true) {
  if (v === 0) return "var(--color-muted)";
  if (isPositiveGood) return v > 0 ? "var(--color-success)" : "var(--color-danger)";
  return v > 0 ? "var(--color-danger)" : "var(--color-success)";
}

const MESES = [1,2,3,4,5,6,7,8,9,10,11,12];

export default function DRETable({ lancamentos, anoFiltro, onCellClick }: DRETableProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<DREGrupo>>(new Set(["receita"]));
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set(["receita-Serviços"]));

  const toggleGroup = (grupo: DREGrupo) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(grupo)) next.delete(grupo); else next.add(grupo);
      return next;
    });
  };

  const toggleSub = (grupo: DREGrupo, sub: string) => {
    const key = `${grupo}-${sub}`;
    setExpandedSubs(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Pre-compute all totals per group/sub/subsub/mes
  const totals = useMemo(() => {
    const result: Record<string, number> = {};
    (["receita","custo","despesa","investimento","financiamento"] as DREGrupo[]).forEach(grupo => {
      Object.keys(CATEGORIAS_DEFAULT[grupo]).forEach(sub => {
        MESES.forEach(mes => {
          result[`${grupo}-${sub}-${mes}`] = getTotalByGroupAndSubcat(lancamentos, grupo, sub, mes);
        });
        result[`${grupo}-${sub}-total`] = MESES.reduce(
          (a, mes) => a + getTotalByGroupAndSubcat(lancamentos, grupo, sub, mes), 0
        );
        
        CATEGORIAS_DEFAULT[grupo][sub].forEach(subsub => {
          MESES.forEach(mes => {
            result[`${grupo}-${sub}-${subsub}-${mes}`] = getTotalBySubSub(lancamentos, grupo, sub, subsub, mes);
          });
          result[`${grupo}-${sub}-${subsub}-total`] = MESES.reduce(
            (a, mes) => a + getTotalBySubSub(lancamentos, grupo, sub, subsub, mes), 0
          );
        });
      });
      MESES.forEach(mes => { result[`${grupo}-${mes}`] = getTotalByGroup(lancamentos, grupo, mes); });
      result[`${grupo}-total`] = MESES.reduce((a, mes) => a + getTotalByGroup(lancamentos, grupo, mes), 0);
    });
    return result;
  }, [lancamentos]);

  const lucroBrutoByMes   = MESES.map(mes => getLucroBruto(lancamentos, mes));
  const resultadoOpByMes  = MESES.map(mes => getResultadoOperacional(lancamentos, mes));
  const variacaoByMes     = MESES.map(mes => getVariacaoCaixa(lancamentos, mes));

  const thStyle: React.CSSProperties = {
    padding: "0.5rem 0.625rem", fontSize: "0.7rem", fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.05em",
    color: "var(--color-muted)", whiteSpace: "nowrap",
    background: "var(--color-surface-2)", position: "sticky", top: 0, zIndex: 2,
    borderBottom: "1px solid var(--color-border)",
  };

  const labelThStyle: React.CSSProperties = {
    ...thStyle, textAlign: "left", position: "sticky", left: 0, zIndex: 3,
    minWidth: 220, maxWidth: 220,
  };

  const sectionHeaderStyle = (isExpanded: boolean): React.CSSProperties => ({
    padding: "0.625rem 0.75rem",
    background: "var(--color-surface-3)",
    borderTop: "1px solid var(--color-border)",
    borderBottom: "1px solid var(--color-border)",
    fontWeight: 700, fontSize: "0.8rem",
    color: "var(--color-gold)",
    cursor: "pointer",
    display: "flex", alignItems: "center", gap: "0.5rem",
    whiteSpace: "nowrap",
    position: "sticky", left: 0, zIndex: 1,
    userSelect: "none" as const,
  });

  const subRowStyle = (clickable: boolean): React.CSSProperties => ({
    padding: "0.5rem 0.75rem 0.5rem 1.5rem",
    fontSize: "0.8rem", color: "var(--color-cream)",
    whiteSpace: "nowrap",
    position: "sticky", left: 0,
    background: "var(--color-surface)",
    cursor: clickable ? "pointer" : "default",
    display: "flex", alignItems: "center", gap: "0.25rem"
  });

  const subSubRowStyle: React.CSSProperties = {
    padding: "0.5rem 0.75rem 0.5rem 2.5rem",
    fontSize: "0.75rem", color: "var(--color-cream-dim)",
    whiteSpace: "nowrap",
    position: "sticky", left: 0,
    background: "var(--color-surface-2)",
  };

  const calcRowStyle: React.CSSProperties = {
    padding: "0.625rem 0.75rem",
    fontWeight: 700, fontSize: "0.8125rem",
    borderTop: "2px solid var(--color-border)",
    whiteSpace: "nowrap",
    position: "sticky", left: 0, zIndex: 1,
    background: "var(--color-bg)",
  };

  const cellStyle = (clickable = false): React.CSSProperties => ({
    padding: "0.5rem 0.625rem",
    textAlign: "right", fontSize: "0.8rem",
    cursor: clickable ? "pointer" : "default",
    whiteSpace: "nowrap",
  });

  const renderGroupRows = (grupo: DREGrupo) => {
    const isExpanded = expandedGroups.has(grupo);
    const isNegative = grupo !== "receita";

    return (
      <>
        {/* Group Header Row */}
        <tr>
          <td style={{ padding: 0, position: "sticky", left: 0, zIndex: 1 }}>
            <div style={sectionHeaderStyle(isExpanded)} onClick={() => toggleGroup(grupo)}>
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {GRUPO_LABELS[grupo]}
            </div>
          </td>
          {MESES.map(mes => (
            <td key={mes} style={{ ...cellStyle(), background: "var(--color-surface-3)", fontWeight: 700 }}>
              <span style={{ color: cellColor(totals[`${grupo}-${mes}`], !isNegative) }}>
                {totals[`${grupo}-${mes}`] !== 0 ? fmt(totals[`${grupo}-${mes}`]) : "—"}
              </span>
            </td>
          ))}
          <td style={{ ...cellStyle(), background: "var(--color-surface-3)", fontWeight: 700, borderLeft: "1px solid var(--color-border)" }}>
            <span style={{ color: cellColor(totals[`${grupo}-total`], !isNegative) }}>
              {fmt(totals[`${grupo}-total`])}
            </span>
          </td>
        </tr>

        {/* Subcategory Rows */}
        {isExpanded && Object.keys(CATEGORIAS_DEFAULT[grupo]).map(sub => {
          const isSubExpanded = expandedSubs.has(`${grupo}-${sub}`);
          const hasSubSubs = CATEGORIAS_DEFAULT[grupo][sub].length > 0;
          return (
            <React.Fragment key={sub}>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,175,140,0.04)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <td style={{ padding: 0, position: "sticky", left: 0 }}>
                  <div style={subRowStyle(hasSubSubs)} onClick={() => hasSubSubs && toggleSub(grupo, sub)}>
                    <span style={{ color: "var(--color-border-light)", marginRight: 4 }}>└</span>
                    {hasSubSubs && (isSubExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
                    {sub}
                  </div>
                </td>
                {MESES.map(mes => {
                  const val = totals[`${grupo}-${sub}-${mes}`];
                  return (
                    <td key={mes}
                      style={{ ...cellStyle(true) }}
                      onClick={() => val !== 0 && onCellClick(grupo, sub, mes)}
                      title={val !== 0 ? `Ver lançamentos de ${sub} em ${MESES_ABREV[mes-1]}` : undefined}
                    >
                      <span style={{
                        color: val !== 0 ? cellColor(val, !isNegative) : "var(--color-muted-2)",
                        textDecoration: val !== 0 ? "underline dotted" : "none",
                      }}>
                        {val !== 0 ? fmt(val) : "—"}
                      </span>
                    </td>
                  );
                })}
                <td style={{ ...cellStyle(), borderLeft: "1px solid var(--color-border)" }}>
                  <span style={{ color: totals[`${grupo}-${sub}-total`] !== 0 ? cellColor(totals[`${grupo}-${sub}-total`], !isNegative) : "var(--color-muted-2)", fontWeight: "bold" }}>
                    {totals[`${grupo}-${sub}-total`] !== 0 ? fmt(totals[`${grupo}-${sub}-total`]) : "—"}
                  </span>
                </td>
              </tr>
              
              {/* Nível 3: Sub-subcategorias */}
              {isExpanded && isSubExpanded && CATEGORIAS_DEFAULT[grupo][sub].map(subsub => (
                <tr key={subsub} style={{ borderBottom: "1px solid var(--color-border)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,175,140,0.08)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: 0, position: "sticky", left: 0 }}>
                    <div style={subSubRowStyle}>
                      <span style={{ color: "var(--color-border-light)", marginRight: 6 }}>└</span>
                      {subsub}
                    </div>
                  </td>
                  {MESES.map(mes => {
                    const val = totals[`${grupo}-${sub}-${subsub}-${mes}`];
                    return (
                      <td key={mes} style={{ ...cellStyle() }}>
                        <span style={{ color: val !== 0 ? cellColor(val, !isNegative) : "var(--color-muted-3)" }}>
                          {val !== 0 ? fmt(val) : "—"}
                        </span>
                      </td>
                    );
                  })}
                  <td style={{ ...cellStyle(), borderLeft: "1px solid var(--color-border)" }}>
                    <span style={{ color: totals[`${grupo}-${sub}-${subsub}-total`] !== 0 ? cellColor(totals[`${grupo}-${sub}-${subsub}-total`], !isNegative) : "var(--color-muted-3)" }}>
                      {totals[`${grupo}-${sub}-${subsub}-total`] !== 0 ? fmt(totals[`${grupo}-${sub}-${subsub}-total`]) : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </React.Fragment>
          );
        })}
      </>
    );
  };

  const renderCalcRow = (
    label: string,
    values: number[],
    positiveGood = true,
    style?: React.CSSProperties
  ) => (
    <tr style={style}>
      <td style={{ padding: 0, position: "sticky", left: 0, zIndex: 1 }}>
        <div style={{ ...calcRowStyle, ...(style ?? {}) }}>
          {label}
        </div>
      </td>
      {values.map((v, i) => (
        <td key={i} style={{ ...cellStyle(), fontWeight: 700, borderTop: "2px solid var(--color-border)", ...(style ?? {}) }}>
          <span style={{ color: cellColor(v, positiveGood) }}>
            {fmt(v)}
          </span>
        </td>
      ))}
      <td style={{ ...cellStyle(), fontWeight: 700, borderTop: "2px solid var(--color-border)", borderLeft: "1px solid var(--color-border)", ...(style ?? {}) }}>
        <span style={{ color: cellColor(values.reduce((a,b) => a+b, 0), positiveGood) }}>
          {fmt(values.reduce((a,b) => a+b, 0))}
        </span>
      </td>
    </tr>
  );

  return (
    <div style={{ overflowX: "auto", borderRadius: "0.875rem", border: "1px solid var(--color-border)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1200 }}>
        <thead>
          <tr>
            <th style={labelThStyle}>Descrição</th>
            {MESES_ABREV.map((m, i) => (
              <th key={i} style={{ ...thStyle, textAlign: "right", minWidth: 90 }}>{m}</th>
            ))}
            <th style={{ ...thStyle, textAlign: "right", minWidth: 110, borderLeft: "1px solid var(--color-border)", color: "var(--color-gold)" }}>Total Ano</th>
          </tr>
        </thead>
        <tbody>
          {/* RECEITA */}
          {renderGroupRows("receita")}

          {/* CUSTO OPERACIONAL */}
          {renderGroupRows("custo")}

          {/* = LUCRO BRUTO */}
          {renderCalcRow("= LUCRO BRUTO", lucroBrutoByMes, true, {
            color: "var(--color-gold)",
            background: "rgba(212,175,140,0.08)",
          })}

          {/* DESPESAS */}
          {renderGroupRows("despesa")}

          {/* = RESULTADO OPERACIONAL */}
          {renderCalcRow("= RESULTADO OPERACIONAL", resultadoOpByMes, true, {
            color: "var(--color-cream)",
            background: "rgba(255,255,255,0.04)",
          })}

          {/* INVESTIMENTOS */}
          {renderGroupRows("investimento")}

          {/* FINANCIAMENTO */}
          {renderGroupRows("financiamento")}

          {/* = VARIAÇÃO DE CAIXA */}
          {renderCalcRow("= VARIAÇÃO DE CAIXA", variacaoByMes, true, {
            color: "var(--color-gold-bright)",
            background: "rgba(212,175,140,0.12)",
            fontSize: "0.875rem",
          })}
        </tbody>
      </table>
    </div>
  );
}
