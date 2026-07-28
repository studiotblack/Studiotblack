"use client";

import { useState } from "react";
import { colaboradores, servicos, receitaDiaria } from "@/lib/mock-data";
import {
  TrendingUp, Users, Calendar, DollarSign, BarChart3,
  ArrowUpRight, ArrowDownRight, Award, PieChart as PieIcon, Download
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";

export default function RelatoriosPage() {
  const [period, setPeriod] = useState("mes"); // mes | trimestre | ano

  const scale = period === "mes" ? 1 : period === "trimestre" ? 2.8 : 10.4;
  const formatCurrency = (val: number) => {
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  // 1. Commission statistics
  const comissoes = colaboradores.map(c => {
    const receita = c.receitaMes * scale;
    const comissao = receita * (c.comissaoPercent / 100);
    return {
      nome: c.nome,
      receita,
      comissao,
      cargo: c.cargo
    };
  });

  // 2. Services statistics
  const categoriaDados = [
    { name: "Corte", value: 450 * scale },
    { name: "Barba", value: 310 * scale },
    { name: "Combos", value: 580 * scale },
    { name: "Tratamentos", value: 180 * scale },
  ];
  const COLORS = ["#d4af8c", "#3498db", "#9b59b6", "#2ecc71"];

  // 3. Billing daily / monthly
  const billingData = receitaDiaria.map(r => ({
    data: r.data,
    Receita: r.receita * scale,
    Despesas: r.despesa * scale,
    Lucro: (r.receita - r.despesa) * scale
  }));

  const handleExport = (tipo: string) => {
    alert(`Exportação do relatório de ${tipo} iniciada. O arquivo CSV será baixado em instantes.`);
  };

  return (
    <div className="page-container animate-fadeIn">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title text-glow-gold">Relatórios Operacionais</h1>
          <p className="page-subtitle">Relatórios gerenciais, comissões de colaboradores e desempenho financeiro</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: "auto" }}>
            <option value="mes">Este Mês</option>
            <option value="trimestre">Este Trimestre</option>
            <option value="ano">Este Ano</option>
          </select>
          <button className="btn btn-ghost" onClick={() => handleExport("Geral")}>
            <Download size={16} />
            <span>Exportar Tudo</span>
          </button>
        </div>
      </div>

      {/* Grid: Financial Chart */}
      <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }} className="grid-cols-1 lg:grid-cols-3">
        
        {/* Billing timeline */}
        <div className="card" style={{ gridColumn: "span 2" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>Evolução de Lucratividade</h3>
            <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Receitas vs Despesas vs Lucro Líquido</span>
          </div>
          <div style={{ height: 300, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={billingData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="data" stroke="var(--color-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)", borderRadius: "8px" }} />
                <Legend wrapperStyle={{ fontSize: "0.75rem", marginTop: "10px" }} />
                <Line type="monotone" dataKey="Receita" stroke="var(--color-gold)" strokeWidth={2} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Despesas" stroke="var(--color-danger)" strokeWidth={1.5} />
                <Line type="monotone" dataKey="Lucro" stroke="var(--color-success)" strokeWidth={2} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Share by Category */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.5rem" }}>Composição de Receitas</h3>
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginBottom: "1.25rem" }}>Faturamento por categoria de serviço</span>
          
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoriaDados}
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoriaDados.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)", borderRadius: "8px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem" }}>
            {categoriaDados.map((item, idx) => (
              <div key={idx} style={{ display: "flex", justifyItems: "center", justifyContent: "space-between", fontSize: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span className="collab-dot" style={{ backgroundColor: COLORS[idx] }} />
                  <span style={{ color: "var(--color-cream-dim)" }}>{item.name}</span>
                </div>
                <strong style={{ color: "var(--color-cream)" }}>
                  {formatCurrency(item.value)}
                </strong>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Row 2: Commissions Table */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>Comissões e Repasses de Barbeiros</h3>
            <p style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginTop: "2px" }}>Resumo de repasses devidos com base no percentual cadastrado por barbeiro</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => handleExport("Comissões")}>
            <Download size={14} />
            <span>Exportar Folha</span>
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Profissional</th>
                <th>Cargo</th>
                <th style={{ textAlign: "right" }}>Faturamento Gerado</th>
                <th style={{ textAlign: "right" }}>Comissão (%)</th>
                <th style={{ textAlign: "right" }}>Valor à Repassar</th>
                <th style={{ textAlign: "right" }}>Líquido Barbearia</th>
              </tr>
            </thead>
            <tbody>
              {comissoes.map((c, idx) => {
                const liq = c.receita - c.comissao;
                const colabOrig = colaboradores[idx];
                return (
                  <tr key={idx}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <div className="collab-dot" style={{ backgroundColor: colabOrig?.cor || "#d4af8c" }} />
                        <span style={{ fontWeight: 600, color: "var(--color-cream)" }}>{c.nome}</span>
                      </div>
                    </td>
                    <td>{c.cargo}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{formatCurrency(c.receita)}</td>
                    <td style={{ textAlign: "right", color: "var(--color-gold)" }}>{colabOrig?.comissaoPercent}%</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "var(--color-success)" }}>{formatCurrency(c.comissao)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "var(--color-gold-bright)" }}>{formatCurrency(liq)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
