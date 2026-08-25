"use client";

import { useState, useEffect } from "react";
import { colaboradores, agendamentosHoje, kpisDashboard, receitaDiaria, servicos, produtos } from "@/lib/mock-data";
import {
  TrendingUp, Users, Calendar, CheckSquare, Package, Clock, DollarSign,
  UserCheck, Scissors, ArrowUpRight, ArrowDownRight, ClipboardList
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, BarChart, Bar, Cell
} from "recharts";

export default function BarbershopDashboard() {
  const [period, setPeriod] = useState("mes"); // hoje | semana | mes

  // Simple filter scaling factor for demo responsiveness
  const scale = period === "hoje" ? 0.05 : period === "semana" ? 0.25 : 1;

  // Faturamento (entradas reais do banco no período) e Saldo Líquido (saldo bancário
  // atual consolidado) — puxados do módulo Financeiro, não são mais dado fictício.
  const [resumoFinanceiro, setResumoFinanceiro] = useState({ faturamentoPeriodo: 0, saldoLiquido: 0 });
  useEffect(() => {
    fetch(`/api/financeiro/resumo-dashboard?periodo=${period}`)
      .then(r => r.ok ? r.json() : { faturamentoPeriodo: 0, saldoLiquido: 0 })
      .then(setResumoFinanceiro)
      .catch(() => {});
  }, [period]);

  // KPIs
  const totalReceita = resumoFinanceiro.faturamentoPeriodo;
  const saldoLiquido = resumoFinanceiro.saldoLiquido;
  const totalAgendamentos = Math.round(0 * scale); // 0 since data is clear
  const totalClientes = Math.round(kpisDashboard.clientesAtivos * scale);
  
  // Format currency
  const formatCurrency = (val: number) => {
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  // Prepare chart data
  const chartData = receitaDiaria.map(item => ({
    data: item.data,
    Receita: item.receita * scale,
    Despesas: item.despesa * scale,
  }));

  // Services ranking
  const topServices = servicos
    .slice(0, 5)
    .map(s => ({
      nome: s.nome,
      quantidade: Math.round(s.totalRealizado * scale),
      receita: s.totalRealizado * s.preco * scale
    }))
    .sort((a, b) => b.quantidade - a.quantidade);

  return (
    <div className="page-container animate-fadeIn">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title text-glow-gold">Painel de Gestão</h1>
          <p className="page-subtitle">Bem-vindo ao Black Gestão — Studio T' Black</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", background: "var(--color-surface-2)", padding: "4px", borderRadius: "8px", border: "1px solid var(--color-border)" }}>
          {["hoje", "semana", "mes"].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="btn btn-sm"
              style={{
                background: period === p ? "var(--color-gold)" : "transparent",
                color: period === p ? "var(--color-bg)" : "var(--color-cream-dim)",
                fontWeight: period === p ? 600 : 400,
                borderRadius: "6px"
              }}
            >
              {p === "hoje" ? "Hoje" : p === "semana" ? "Semana" : "Este Mês"}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.5rem", marginBottom: "1.5rem" }}>
        
        {/* KPI 1 */}
        <div className="kpi-card">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--color-muted)", fontWeight: 500 }}>Faturamento Total</span>
            <div style={{ padding: "0.5rem", background: "var(--color-gold-glow-sm)", borderRadius: "8px" }}>
              <TrendingUp size={20} className="text-gold" />
            </div>
          </div>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>{formatCurrency(totalReceita)}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--color-muted)" }}>
            <span>Entradas reais no banco {period === "hoje" ? "hoje" : period === "semana" ? "nesta semana" : "neste mês"}</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="kpi-card">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--color-muted)", fontWeight: 500 }}>Saldo Líquido</span>
            <div style={{ padding: "0.5rem", background: "rgba(46, 204, 113, 0.1)", borderRadius: "8px" }}>
              <DollarSign size={20} className="value-positive" />
            </div>
          </div>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0, color: saldoLiquido >= 0 ? "var(--color-cream)" : "var(--color-danger)" }}>{formatCurrency(saldoLiquido)}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", marginTop: "0.5rem", fontSize: "0.75rem", color: saldoLiquido >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
            {saldoLiquido >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            <span>Saldo bancário consolidado, agora</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="kpi-card">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--color-muted)", fontWeight: 500 }}>Agendamentos</span>
            <div style={{ padding: "0.5rem", background: "rgba(52, 152, 219, 0.1)", borderRadius: "8px" }}>
              <Calendar size={20} className="text-info" />
            </div>
          </div>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>{totalAgendamentos}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--color-gold)" }}>
            <Clock size={14} />
            <span>Taxa de ocupação de {kpisDashboard.taxaOcupacao}%</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="kpi-card">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--color-muted)", fontWeight: 500 }}>Clientes Ativos</span>
            <div style={{ padding: "0.5rem", background: "var(--color-gold-glow-sm)", borderRadius: "8px" }}>
              <Users size={20} className="text-gold" />
            </div>
          </div>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>{totalClientes}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--color-success)" }}>
            <ArrowUpRight size={14} />
            <span>+{kpisDashboard.novosClientesMes} novos clientes este mês</span>
          </div>
        </div>

      </div>

      {/* Row 2: Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }} className="grid-cols-1 lg:grid-cols-3">
        {/* Main Chart */}
        <div className="card" style={{ gridColumn: "span 2" }}>
          <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.25rem" }}>Desempenho Financeiro</h3>
          <div style={{ height: 320, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-gold)" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="var(--color-gold)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-danger)" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="var(--color-danger)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="data" stroke="var(--color-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)", borderRadius: "8px" }} />
                <Area type="monotone" dataKey="Receita" stroke="var(--color-gold)" fillOpacity={1} fill="url(#colorReceita)" strokeWidth={2} />
                <Area type="monotone" dataKey="Despesas" stroke="var(--color-danger)" fillOpacity={1} fill="url(#colorDespesa)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Services ranking */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.25rem" }}>Serviços Mais Vendidos</h3>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1rem" }}>
            {topServices.map((serv, index) => (
              <div key={index} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem" }}>
                  <span style={{ fontWeight: 500, color: "var(--color-cream)" }}>{index+1}. {serv.nome}</span>
                  <span style={{ color: "var(--color-gold)", fontWeight: 600 }}>{serv.quantidade} atendimentos</span>
                </div>
                <div className="stat-bar-track">
                  <div
                    className="stat-bar-fill"
                    style={{
                      width: `${(serv.quantidade / topServices[0].quantidade) * 100}%`,
                      background: "linear-gradient(90deg, var(--color-gold-dark), var(--color-gold))"
                    }}
                  />
                </div>
                <span style={{ fontSize: "0.7rem", color: "var(--color-muted)" }}>Faturamento: {formatCurrency(serv.receita)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Timelines / Lists */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }} className="grid-cols-1 lg:grid-cols-2">
        {/* Next Appointments today */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600 }}>Próximos Agendamentos de Hoje</h3>
            <span className="badge badge-gold">Hoje</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: 350, overflowY: "auto", paddingRight: "0.5rem" }}>
            {agendamentosHoje
              .filter(a => a.status === "AGENDADO" || a.status === "CONFIRMADO")
              .slice(0, 5)
              .map((agenda) => (
                <div
                  key={agenda.id}
                  style={{
                    display: "flex", alignItems: "center", justifyItems: "center",
                    padding: "0.75rem 1rem", borderRadius: "10px",
                    background: "var(--color-surface-2)",
                    border: "1px solid var(--color-border)",
                    gap: "1rem"
                  }}
                >
                  <div style={{
                    width: 54, height: 54, borderRadius: "8px",
                    background: "var(--color-surface-3)", borderLeft: `3px solid ${agenda.corColab}`,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, color: "var(--color-gold)", fontSize: "0.875rem"
                  }}>
                    <span>{agenda.hora}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--color-cream)" }}>{agenda.cliente}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--color-muted)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span>{agenda.servico}</span>
                      <span>•</span>
                      <span style={{ color: agenda.corColab }}>{colaboradores.find(c => c.id === agenda.colaborador)?.nome || "Profissional"}</span>
                    </div>
                  </div>
                  <span className={`badge ${agenda.status === "CONFIRMADO" ? "status-confirmado" : "status-agendado"}`}>
                    {agenda.status}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Low Stock Products */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600 }}>Alertas de Reposição de Estoque</h3>
            <span className="badge badge-danger">Crítico</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: 350, overflowY: "auto", paddingRight: "0.5rem" }}>
            {produtos
              .map(p => ({
                ...p,
                status: p.estoqueAtual <= p.estoqueMinimo ? "BAIXO" : "OK"
              }))
              .filter(p => p.status === "BAIXO")
              .slice(0, 5)
              .map((prod) => (
                <div
                  key={prod.id}
                  style={{
                    display: "flex", alignItems: "center", justifyItems: "center",
                    padding: "0.75rem 1rem", borderRadius: "10px",
                    background: "var(--color-surface-2)",
                    border: "1px solid var(--color-border)",
                    gap: "1rem"
                  }}
                >
                  <div style={{
                    width: 48, height: 48, borderRadius: "8px",
                    background: "rgba(231, 76, 60, 0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--color-danger)"
                  }}>
                    <Package size={22} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--color-cream)" }}>{prod.nome}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>
                      Mínimo requerido: <strong style={{ color: "var(--color-cream)" }}>{prod.estoqueMinimo} {prod.unidade}</strong>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-danger)" }}>
                      {prod.estoqueAtual} {prod.unidade}
                    </div>
                    <span className="badge badge-danger" style={{ fontSize: "0.65rem", padding: "1px 6px" }}>Recomprar</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

    </div>
  );
}
