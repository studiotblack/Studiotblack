"use client";

import { TrendingUp, TrendingDown, AlertTriangle, BarChart2, Percent } from "lucide-react";
import type { DRELancamento } from "@/lib/dre-data";
import {
  getTotalByGroupAndSubcat, getTotalByGroup,
  getResultadoOperacional, MESES,
} from "@/lib/dre-data";

interface IndicadoresBarProps {
  lancamentos: DRELancamento[];
}

const fmt = (v: number, decimals = 1) => `${v.toFixed(decimals)}%`;
const fmtR = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function IndicadoresBar({ lancamentos }: IndicadoresBarProps) {
  // Totais anuais
  const receitaTotal = [1,2,3,4,5,6,7,8,9,10,11,12].reduce(
    (acc, mes) => acc + getTotalByGroup(lancamentos, "receita", mes), 0
  );
  const aluguelTotal = [1,2,3,4,5,6,7,8,9,10,11,12].reduce(
    (acc, mes) => acc + getTotalByGroupAndSubcat(lancamentos, "despesa", "Aluguel", mes), 0
  );
  const comissoesTotal = [1,2,3,4,5,6,7,8,9,10,11,12].reduce(
    (acc, mes) => acc + getTotalByGroupAndSubcat(lancamentos, "custo", "Comissões", mes), 0
  );
  const resultadoOpTotal = [1,2,3,4,5,6,7,8,9,10,11,12].reduce(
    (acc, mes) => acc + getResultadoOperacional(lancamentos, mes), 0
  );

  const pctAluguel     = receitaTotal > 0 ? (aluguelTotal / receitaTotal) * 100 : 0;
  const pctComissoes   = receitaTotal > 0 ? (comissoesTotal / receitaTotal) * 100 : 0;
  const margemOp       = receitaTotal > 0 ? (resultadoOpTotal / receitaTotal) * 100 : 0;

  const aluguelAlert = pctAluguel > 10;

  const indicadores = [
    {
      id: "aluguel",
      label: "Aluguel / Receita",
      value: fmt(pctAluguel),
      sub: `R$ ${fmtR(aluguelTotal)} do total`,
      alert: aluguelAlert,
      alertMsg: "Acima de 10% da receita",
      icon: aluguelAlert ? AlertTriangle : BarChart2,
      color: aluguelAlert ? "var(--color-danger)" : "var(--color-gold)",
      bg: aluguelAlert ? "rgba(231,76,60,0.1)" : "rgba(212,175,140,0.08)",
      border: aluguelAlert ? "var(--color-danger)" : "var(--color-border-light)",
    },
    {
      id: "comissoes",
      label: "Comissões / Receita",
      value: fmt(pctComissoes),
      sub: `R$ ${fmtR(comissoesTotal)} do total`,
      alert: false,
      alertMsg: "",
      icon: Percent,
      color: "var(--color-info)",
      bg: "rgba(52,152,219,0.08)",
      border: "var(--color-border-light)",
    },
    {
      id: "margem",
      label: "Margem Operacional",
      value: fmt(margemOp),
      sub: `R$ ${fmtR(resultadoOpTotal)} resultado`,
      alert: margemOp < 0,
      alertMsg: "Resultado operacional negativo",
      icon: margemOp >= 0 ? TrendingUp : TrendingDown,
      color: margemOp >= 0 ? "var(--color-success)" : "var(--color-danger)",
      bg: margemOp >= 0 ? "rgba(46,204,113,0.08)" : "rgba(231,76,60,0.08)",
      border: "var(--color-border-light)",
    },
    {
      id: "receita",
      label: "Receita Total (Ano)",
      value: fmtR(receitaTotal),
      sub: "Serviços + Produtos − Descontos",
      alert: false,
      alertMsg: "",
      icon: TrendingUp,
      color: "var(--color-gold-bright)",
      bg: "rgba(212,175,140,0.06)",
      border: "var(--color-border-light)",
    },
  ];

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: "1rem",
      marginTop: "1.5rem",
    }}>
      {indicadores.map(ind => {
        const Icon = ind.icon;
        return (
          <div key={ind.id} style={{
            background: ind.bg,
            border: `1px solid ${ind.alert ? ind.color : ind.border}`,
            borderRadius: "0.875rem",
            padding: "1rem 1.25rem",
            display: "flex", flexDirection: "column", gap: "0.5rem",
            position: "relative", overflow: "hidden",
          }}>
            {/* Alert band */}
            {ind.alert && (
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 3,
                background: ind.color,
              }} />
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-muted)", fontWeight: 600 }}>
                {ind.label}
              </span>
              <Icon size={16} color={ind.color} />
            </div>

            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: ind.color, lineHeight: 1 }}>
              {ind.value}
            </div>

            <div style={{ fontSize: "0.7rem", color: "var(--color-muted)" }}>
              {ind.sub}
            </div>

            {ind.alert && (
              <div style={{
                display: "flex", alignItems: "center", gap: "0.25rem",
                fontSize: "0.7rem", color: ind.color, fontWeight: 600, marginTop: 2,
              }}>
                <AlertTriangle size={11} />
                {ind.alertMsg}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
