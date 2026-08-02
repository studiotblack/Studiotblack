"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, ComposedChart, LabelList, ReferenceLine
} from 'recharts';
import { Target, TrendingUp, DollarSign, Users, Award, Ticket, Percent } from "lucide-react";
import {
  DesempenhoProfissional, getProfissionaisUnicos,
  getServicosMaisRealizados, getTotalFaturado, getTotalComissao,
  catalogoServicos, TaxaOcupacaoImportada, catalogoProdutos, normalizeProfName
} from "@/lib/performance-data";
import { ConfigMetasType } from "./ConfigMetas";

interface DashboardBIProps {
  data: DesempenhoProfissional[];
  ocupacao: TaxaOcupacaoImportada[];
  metas?: ConfigMetasType;
}

const COLORS = ['#d4af8c', '#3498db', '#2ecc71', '#e74c3c', '#9b59b6', '#f39c12'];
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Rótulo de percentual pra fora das fatias dos gráficos de pizza (o texto padrão do recharts fica escuro demais no tema dark)
const renderPieLabel = (props: any) => {
  const { cx, cy, midAngle, outerRadius, percent } = props;
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 18;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#d4c4b0" fontSize={11} fontWeight={600} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const parseMesAno = (dateStr: string): string => {
  if (!dateStr) return "";
  const clean = dateStr.split(" ")[0];
  if (clean.includes("/")) {
    const parts = clean.split("/");
    if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
    if (parts.length === 2) return `${parts[0]}/${parts[1]}`;
  }
  if (clean.includes("-")) {
    const parts = clean.split("-");
    if (parts.length === 3) {
      if (parts[0].length === 4) return `${parts[1]}/${parts[0]}`;
      return `${parts[1]}/${parts[2]}`;
    }
  }
  return "";
};

export default function DashboardBI({ data, ocupacao, metas }: DashboardBIProps) {
  const [metaGlobal, setMetaGlobal] = useState(15000);

  // Descobre todos os meses disponíveis na base e ordena do mais recente ao mais antigo
  const mesesDisponiveis = useMemo(() => {
    const setMeses = new Set<string>();
    data.forEach(d => {
      const m = parseMesAno(d.data);
      if (m) setMeses.add(m);
    });
    ocupacao.forEach(t => {
      if (t.mesAno) setMeses.add(t.mesAno);
    });
    return Array.from(setMeses).sort((a, b) => {
      const [m1, y1] = a.split("/");
      const [m2, y2] = b.split("/");
      return (parseInt(y2, 10) * 12 + parseInt(m2, 10)) - (parseInt(y1, 10) * 12 + parseInt(m1, 10));
    });
  }, [data, ocupacao]);

  // Premissa: Seleciona por padrão o mês mais recente
  const [selectedMes, setSelectedMes] = useState<string>(() => {
    return mesesDisponiveis.length > 0 ? mesesDisponiveis[0] : "Todos";
  });

  // Atualiza se novos dados forem importados e o mês selecionado não existir mais
  if (mesesDisponiveis.length > 0 && selectedMes !== "Todos" && !mesesDisponiveis.includes(selectedMes)) {
    setSelectedMes(mesesDisponiveis[0]);
  }

  // Filtra dados com base no mês selecionado (se "Todos", pega tudo)
  const filteredData = useMemo(() => {
    if (!selectedMes || selectedMes === "Todos") return data;
    return data.filter(d => parseMesAno(d.data) === selectedMes);
  }, [data, selectedMes]);

  const totalFaturado = getTotalFaturado(filteredData);
  const totalComissao = getTotalComissao(filteredData);
  const lucroEstimado = totalFaturado - totalComissao;

  const progressoMeta = Math.min((totalFaturado / metaGlobal) * 100, 100);
  const faltaParaMeta = Math.max(metaGlobal - totalFaturado, 0);

  // Preparando dados para Gráfico: Faturamento por Barbeiro (do mês selecionado)
  const faturamentoPorBarbeiro = useMemo(() => {
    const profs = getProfissionaisUnicos(filteredData, ocupacao);
    return profs.map(p => {
      const docs = filteredData.filter(d => d.profissional === p);
      const faturado = docs.reduce((acc, curr) => acc + curr.valorBruto, 0);
      const comissao = docs.reduce((acc, curr) => acc + curr.valorComissao, 0);
      return {
        name: p.split(" ")[0],
        Faturado: faturado,
        Comissao: comissao
      };
    }).sort((a, b) => b.Faturado - a.Faturado);
  }, [filteredData, ocupacao]);

  // Preparando dados para Gráfico: Serviços mais realizados (do mês selecionado)
  const topServicos = useMemo(() => {
    return getServicosMaisRealizados(filteredData).slice(0, 5);
  }, [filteredData]);

  const faturamentoMensal = useMemo(() => {
    const records: Record<string, { Faturamento: number, Comissão: number }> = {};
    data.forEach(d => {
      const parts = d.data.split(" ")[0].split("/");
      if (parts.length >= 3) {
        const mesAno = `${parts[1]}/${parts[2]}`;
        if (!records[mesAno]) records[mesAno] = { Faturamento: 0, Comissão: 0 };
        records[mesAno].Faturamento += d.valorBruto;
        records[mesAno].Comissão += d.valorComissao;
      }
    });
    return Object.entries(records).map(([name, vals]) => ({
      name,
      Faturamento: vals.Faturamento,
      "Comissão": vals.Comissão,
      "Retenção do Salão": vals.Faturamento - vals.Comissão,
    })).sort((a, b) => {
      const [m1, y1] = a.name.split("/");
      const [m2, y2] = b.name.split("/");
      return new Date(Number(y1), Number(m1) - 1).getTime() - new Date(Number(y2), Number(m2) - 1).getTime();
    });
  }, [data]);

  // Evolução Histórica de Serviços x Produtos x Comissões Mês a Mês
  const evolucaoServicosProdutosMensal = useMemo(() => {
    const nomeProdutos = new Set(catalogoProdutos.map(p => p.nome.toLowerCase()));
    const isProd = (item: string) => nomeProdutos.has(item.toLowerCase().trim());
    
    const records: Record<string, { servicos: number, produtos: number, comissao: number }> = {};
    data.forEach(d => {
      const parts = d.data.split(" ")[0].split("/");
      if (parts.length >= 3) {
        const mesAno = `${parts[1]}/${parts[2]}`;
        if (!records[mesAno]) records[mesAno] = { servicos: 0, produtos: 0, comissao: 0 };
        
        if (isProd(d.item)) {
          records[mesAno].produtos += d.valorBruto;
        } else {
          records[mesAno].servicos += d.valorBruto;
        }
        records[mesAno].comissao += d.valorComissao;
      }
    });
    
    return Object.entries(records).map(([name, vals]) => ({
      name,
      "Serviços (R$)": vals.servicos,
      "Produtos (R$)": vals.produtos,
      "Comissão (R$)": vals.comissao
    })).sort((a, b) => {
      const [m1, y1] = a.name.split("/");
      const [m2, y2] = b.name.split("/");
      return new Date(Number(y1), Number(m1) - 1).getTime() - new Date(Number(y2), Number(m2) - 1).getTime();
    });
  }, [data]);

  const ocupacaoMensal = useMemo(() => {
    const records: Record<string, { ocupacaoTotal: number, count: number }> = {};
    ocupacao.forEach(t => {
      const m = t.mesAno || "Geral";
      if (!records[m]) records[m] = { ocupacaoTotal: 0, count: 0 };
      records[m].ocupacaoTotal += t.taxaOcupacao;
      records[m].count += 1;
    });
    return Object.entries(records).map(([name, vals]) => ({
      name,
      "Ocupação %": Number(((vals.ocupacaoTotal / vals.count) * 100).toFixed(1))
    })).sort((a, b) => {
      if (a.name === "Geral") return -1;
      if (b.name === "Geral") return 1;
      const [m1, y1] = a.name.split("/");
      const [m2, y2] = b.name.split("/");
      return new Date(Number(y1), Number(m1) - 1).getTime() - new Date(Number(y2), Number(m2) - 1).getTime();
    });
  }, [ocupacao]);

  const topProdutos = useMemo(() => {
    const nomeProdutos = new Set(catalogoProdutos.map(p => p.nome.toLowerCase()));
    const produtosData = filteredData.filter(d => nomeProdutos.has(d.item.toLowerCase()) || (!catalogoServicos[d.item] && !d.item.toLowerCase().includes("corte")));
    
    const contagem: Record<string, { valor: number, qtd: number }> = {};
    produtosData.forEach(d => {
      if (!contagem[d.item]) contagem[d.item] = { valor: 0, qtd: 0 };
      contagem[d.item].valor += d.valorBruto;
      contagem[d.item].qtd += 1;
    });
    
    return Object.entries(contagem)
      .map(([name, val]) => ({ name, Faturado: val.valor, Quantidade: val.qtd }))
      .sort((a, b) => b.Faturado - a.Faturado)
      .slice(0, 5);
  }, [filteredData]);

  // Preparando dados para Gráfico: Ocupação Geral (do mês selecionado)
  const ocupacaoGeral = useMemo(() => {
    const profs = getProfissionaisUnicos(filteredData, ocupacao);
    
    return profs.map(prof => {
      const normalized = normalizeProfName(prof);
      const rec = (selectedMes && selectedMes !== "Todos")
        ? ocupacao.find(t => normalizeProfName(t.profissional) === normalized && t.mesAno === selectedMes)
        : ocupacao.find(t => normalizeProfName(t.profissional) === normalized);
      const taxa = rec ? rec.taxaOcupacao * 100 : 0;

      return {
        name: prof.split(" ")[0],
        "Ocupação %": Number(taxa.toFixed(1))
      };
    }).sort((a, b) => b["Ocupação %"] - a["Ocupação %"]);
  }, [filteredData, selectedMes, ocupacao]);

  // Ticket médio geral do salão (faturamento / itens vendidos no período selecionado)
  const ticketMedioGeral = filteredData.length > 0 ? totalFaturado / filteredData.length : 0;

  // Ticket médio por profissional, pra comparar com a média do salão
  const ticketMedioPorProfissional = useMemo(() => {
    const profs = getProfissionaisUnicos(filteredData, ocupacao);
    return profs.map(p => {
      const docs = filteredData.filter(d => d.profissional === p);
      const faturado = docs.reduce((acc, curr) => acc + curr.valorBruto, 0);
      return {
        name: p.split(" ")[0],
        Ticket: docs.length > 0 ? Number((faturado / docs.length).toFixed(2)) : 0
      };
    }).sort((a, b) => b.Ticket - a.Ticket);
  }, [filteredData, ocupacao]);

  // Ocupação média do salão no período (com e sem o Tiago, que costuma puxar a média pra cima)
  const { ocupacaoMediaSalao, ocupacaoMediaSemTiago } = useMemo(() => {
    const relevantes = (selectedMes && selectedMes !== "Todos")
      ? ocupacao.filter(t => t.mesAno === selectedMes)
      : ocupacao;
    const semTiago = relevantes.filter(t => normalizeProfName(t.profissional) !== "Tiago");
    const media = (arr: TaxaOcupacaoImportada[]) => arr.length > 0 ? (arr.reduce((acc, t) => acc + t.taxaOcupacao, 0) / arr.length) * 100 : 0;
    return {
      ocupacaoMediaSalao: media(relevantes),
      ocupacaoMediaSemTiago: media(semTiago),
    };
  }, [ocupacao, selectedMes]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: "rgba(22,15,16,0.9)", border: "1px solid var(--color-border)", padding: "10px", borderRadius: "8px" }}>
          <p style={{ margin: 0, fontWeight: "bold", color: "var(--color-gold)" }}>{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ margin: 0, color: entry.color }}>
              {entry.name}: {brl(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      
      {/* Seletor de Período do Salão */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", padding: "0.75rem 1.25rem", borderRadius: "8px", border: "1px solid var(--color-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <TrendingUp size={18} color="var(--color-gold)" />
          <span style={{ fontWeight: 600, color: "var(--color-cream)", fontSize: "0.9rem" }}>Período de Exibição (Salão):</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <select 
            value={selectedMes} 
            onChange={e => setSelectedMes(e.target.value)}
            style={{ 
              background: "rgba(0,0,0,0.4)", border: "1px solid var(--color-gold)", 
              padding: "0.4rem 0.85rem", borderRadius: "6px", color: "var(--color-gold)", 
              fontWeight: 600, fontSize: "0.85rem", outline: "none", cursor: "pointer"
            }}
          >
            {mesesDisponiveis.map(m => (
              <option key={m} value={m} style={{ background: "#160f10", color: "#fff" }}>
                {m} {mesesDisponiveis[0] === m ? "(Mês Atual)" : ""}
              </option>
            ))}
            <option value="Todos" style={{ background: "#160f10", color: "#fff" }}>Todos os Meses (Acumulado Total)</option>
          </select>
        </div>
      </div>

      <div className="divider-text">Indicadores do Período</div>

      {/* Indicadores Principais */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.5rem" }}>

        {/* Faturamento */}
        <div className="card" style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
          <div style={{ background: "rgba(212,175,140,0.15)", padding: "0.75rem", borderRadius: "0.75rem", color: "var(--color-gold)" }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <p style={{ fontSize: "0.85rem", color: "var(--color-muted)", margin: "0 0 4px 0" }}>Faturamento Total</p>
            <h3 style={{ fontSize: "1.75rem", margin: 0, color: "var(--color-cream)", fontWeight: 800 }}>
              {brl(totalFaturado)}
            </h3>
          </div>
        </div>

        {/* Comissões */}
        <div className="card" style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
          <div style={{ background: "rgba(231,76,60,0.15)", padding: "0.75rem", borderRadius: "0.75rem", color: "var(--color-danger)" }}>
            <Users size={24} />
          </div>
          <div>
            <p style={{ fontSize: "0.85rem", color: "var(--color-muted)", margin: "0 0 4px 0" }}>Comissões Pagas</p>
            <h3 style={{ fontSize: "1.75rem", margin: 0, color: "var(--color-danger)", fontWeight: 800 }}>
              {brl(totalComissao)}
            </h3>
          </div>
        </div>

        {/* Lucro Estimado (Fat - Comissao) */}
        <div className="card" style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
          <div style={{ background: "rgba(46,204,113,0.15)", padding: "0.75rem", borderRadius: "0.75rem", color: "var(--color-success)" }}>
            <DollarSign size={24} />
          </div>
          <div>
            <p style={{ fontSize: "0.85rem", color: "var(--color-muted)", margin: "0 0 4px 0" }}>Retenção Bruta (Salão)</p>
            <h3 style={{ fontSize: "1.75rem", margin: 0, color: "var(--color-success)", fontWeight: 800 }}>
              {brl(lucroEstimado)}
            </h3>
          </div>
        </div>

        {/* Ticket Médio Geral */}
        <div className="card" style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
          <div style={{ background: "rgba(52,152,219,0.15)", padding: "0.75rem", borderRadius: "0.75rem", color: "var(--color-info)" }}>
            <Ticket size={24} />
          </div>
          <div>
            <p style={{ fontSize: "0.85rem", color: "var(--color-muted)", margin: "0 0 4px 0" }}>Ticket Médio Geral</p>
            <h3 style={{ fontSize: "1.75rem", margin: 0, color: "var(--color-info)", fontWeight: 800 }}>
              {brl(ticketMedioGeral)}
            </h3>
          </div>
        </div>

        {/* Ocupação Total do Salão */}
        <div className="card" style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
          <div style={{ background: "rgba(155,89,182,0.15)", padding: "0.75rem", borderRadius: "0.75rem", color: "#9b59b6" }}>
            <Percent size={24} />
          </div>
          <div>
            <p style={{ fontSize: "0.85rem", color: "var(--color-muted)", margin: "0 0 4px 0" }}>Ocupação Total do Salão</p>
            <h3 style={{ fontSize: "1.75rem", margin: 0, color: "#9b59b6", fontWeight: 800 }}>
              {ocupacaoMediaSalao.toFixed(1)}%
            </h3>
          </div>
        </div>

        {/* Ocupação sem Tiago */}
        <div className="card" style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
          <div style={{ background: "rgba(155,89,182,0.08)", padding: "0.75rem", borderRadius: "0.75rem", color: "#c39bd3" }}>
            <Percent size={24} />
          </div>
          <div>
            <p style={{ fontSize: "0.85rem", color: "var(--color-muted)", margin: "0 0 4px 0" }}>Ocupação sem Tiago</p>
            <h3 style={{ fontSize: "1.75rem", margin: 0, color: "#c39bd3", fontWeight: 800 }}>
              {ocupacaoMediaSemTiago.toFixed(1)}%
            </h3>
          </div>
        </div>

        {/* Meta */}
        <div className="card-gold" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Target size={20} color="var(--color-gold)" />
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--color-gold)" }}>Meta do Mês</span>
            </div>
            {/* Um input simples simulando a configuração da meta */}
            <input 
              type="number" 
              value={metaGlobal} 
              onChange={e => setMetaGlobal(Number(e.target.value))}
              style={{ width: "90px", padding: "2px 8px", fontSize: "0.8rem", textAlign: "right", background: "rgba(0,0,0,0.3)" }} 
              title="Editar Meta"
            />
          </div>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <h3 style={{ fontSize: "1.5rem", margin: 0, color: "var(--color-cream)", fontWeight: 800 }}>
              {progressoMeta.toFixed(1)}%
            </h3>
            <span style={{ fontSize: "0.75rem", color: progressoMeta >= 100 ? "var(--color-success)" : "var(--color-muted-2)" }}>
              {progressoMeta >= 100 ? "Meta Atingida! 🎉" : `Falta ${brl(faltaParaMeta)}`}
            </span>
          </div>

          <div style={{ height: "6px", background: "rgba(0,0,0,0.3)", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{ width: `${progressoMeta}%`, height: "100%", background: "var(--color-gold)", transition: "width 0.5s" }} />
          </div>
        </div>
      </div>

      <div className="divider-text">Análise Gráfica</div>

      {/* Gráficos */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "1.5rem" }}>

        {/* Faturamento por Profissional */}
        <div className="card">
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Award size={18} color="var(--color-gold)" /> Faturamento x Comissão por Profissional
          </h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={faturamentoPorBarbeiro} margin={{ top: 25, right: 0, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d1f20" vertical={false} />
                <XAxis dataKey="name" stroke="#7a6060" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#7a6060" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `R$${val}`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Faturado" fill="#d4af8c" radius={[4, 4, 0, 0]} maxBarSize={50}
                  label={{ position: 'top', fontSize: 10, fill: '#d4af8c', formatter: (v: any) => `R$${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` }}
                />
                <Bar dataKey="Comissao" fill="#3498db" radius={[4, 4, 0, 0]} maxBarSize={50}
                  label={{ position: 'top', fontSize: 10, fill: '#3498db', formatter: (v: any) => `R$${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Serviços Mais Realizados */}
        <div className="card">
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1.5rem" }}>
            Top 5 Serviços
          </h3>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={topServicos}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="count"
                  stroke="none"
                  label={renderPieLabel}
                  labelLine={{ stroke: "#7a6060", strokeWidth: 1 }}
                >
                  {topServicos.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ background: "rgba(22,15,16,0.9)", border: "1px solid #2d1f20", borderRadius: "8px" }}
                  itemStyle={{ color: "#d4af8c" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {topServicos.map((s, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS[i % COLORS.length] }} />
                  <span style={{ color: "var(--color-cream-dim)" }}>{s.name}</span>
                </div>
                <span style={{ fontWeight: "bold" }}>{s.count}x</span>
              </div>
            ))}
          </div>
        </div>

        {/* Ticket Médio por Profissional, comparado com a média do salão */}
        <div className="card">
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Ticket size={18} color="var(--color-gold)" /> Ticket Médio por Profissional
          </h3>
          <p style={{ fontSize: "0.78rem", color: "var(--color-muted)", margin: "0 0 1rem 0" }}>Quem está vendendo bem acima ou abaixo da média do salão (linha tracejada)</p>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={ticketMedioPorProfissional} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d1f20" vertical={false} />
                <XAxis dataKey="name" stroke="#7a6060" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#7a6060" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `R$${val}`} />
                <Tooltip contentStyle={{ background: "rgba(22,15,16,0.9)", border: "1px solid var(--color-border)", borderRadius: "8px" }} formatter={(value: any) => [brl(Number(value)), 'Ticket Médio']} />
                <ReferenceLine y={ticketMedioGeral} stroke="var(--color-gold)" strokeDasharray="4 3" label={{ value: `Média: ${brl(ticketMedioGeral)}`, position: 'insideTopRight', fill: 'var(--color-gold)', fontSize: 11 }} />
                <Bar dataKey="Ticket" radius={[4, 4, 0, 0]} maxBarSize={45}>
                  {ticketMedioPorProfissional.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.Ticket >= ticketMedioGeral ? "#2ecc71" : "#e74c3c"} />
                  ))}
                  <LabelList dataKey="Ticket" position="top" fontSize={10} fill="var(--color-cream-dim)" formatter={(v: any) => brl(Number(v))} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Ocupação da Equipe + Composição do Faturamento lado a lado (compactos) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "1.5rem" }}>

        {/* Gráfico de Ocupação Geral */}
        <div className="card">
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Users size={18} color="var(--color-gold)" /> Comparativo de Ocupação (Equipe)
          </h3>
          <div style={{ width: '100%', height: Math.max(130, ocupacaoGeral.length * 28 + 20) }}>
            <ResponsiveContainer>
              <BarChart data={ocupacaoGeral} margin={{ top: 0, right: 35, left: 0, bottom: 0 }} layout="vertical" barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#2d1f20" horizontal={false} />
                <XAxis type="number" stroke="#7a6060" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} domain={[0, 100]} />
                <YAxis dataKey="name" type="category" width={72} stroke="#7a6060" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "rgba(22,15,16,0.9)", border: "1px solid var(--color-border)", borderRadius: "8px" }} formatter={(value: any) => [`${value}%`, 'Ocupação']} />
                <Bar dataKey="Ocupação %" fill="#9b59b6" radius={[0, 4, 4, 0]} maxBarSize={18}>
                  <LabelList dataKey="Ocupação %" position="right" formatter={(v: any) => `${v}%`} fill="#c39bd3" fontSize={12} fontWeight={600} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Evolução Mensal: Serviços + Produtos empilhados (soma = faturamento) com a Comissão sobreposta como linha */}
        <div className="card">
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <TrendingUp size={18} color="var(--color-gold)" /> Evolução Mensal: Composição do Faturamento
          </h3>
          <p style={{ fontSize: "0.78rem", color: "var(--color-muted)", margin: "0 0 0.75rem 0" }}>Serviços + Produtos empilhados = faturamento total; comissão paga em linha</p>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <ComposedChart data={evolucaoServicosProdutosMensal} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d1f20" vertical={false} />
                <XAxis dataKey="name" stroke="#7a6060" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#7a6060" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `R$${val}`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="Serviços (R$)" stackId="fat" fill="#d4af8c" maxBarSize={45}>
                  <LabelList dataKey="Serviços (R$)" position="center" fontSize={9} fill="#3a2a1a" fontWeight={600} formatter={(v: any) => v > 0 ? `R$${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : ''} />
                </Bar>
                <Bar dataKey="Produtos (R$)" stackId="fat" fill="#3498db" radius={[4, 4, 0, 0]} maxBarSize={45}>
                  <LabelList dataKey="Produtos (R$)" position="center" fontSize={9} fill="#0a2233" fontWeight={600} formatter={(v: any) => v > 0 ? `R$${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : ''} />
                </Bar>
                <Line type="monotone" dataKey="Comissão (R$)" stroke="#2ecc71" strokeWidth={3} dot={{ fill: '#2ecc71', r: 4 }} activeDot={{ r: 6 }}
                  label={{ position: 'bottom', fontSize: 9, fill: '#2ecc71', formatter: (v: any) => `R$${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      <div className="divider-text">Histórico e Ranking</div>

      {/* Gráficos Históricos e de Produtos */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem" }}>

        {/* Retenção do Salão x Comissão Mensal (empilhado — a soma das duas é o faturamento total) */}
        <div className="card">
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <TrendingUp size={18} color="var(--color-gold)" /> Histórico Mensal (Financeiro)
          </h3>
          <p style={{ fontSize: "0.78rem", color: "var(--color-muted)", margin: "0 0 1rem 0" }}>Como o faturamento de cada mês se divide entre o que fica com o salão e o que vai de comissão</p>
          <div style={{ width: '100%', height: 230 }}>
            <ResponsiveContainer>
              <BarChart data={faturamentoMensal} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d1f20" vertical={false} />
                <XAxis dataKey="name" stroke="#7a6060" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#7a6060" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `R$${val}`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Retenção do Salão" stackId="fin" fill="#2ecc71" maxBarSize={45}>
                  <LabelList dataKey="Retenção do Salão" position="center" fontSize={9} fill="#0a2b18" fontWeight={600} formatter={(v: any) => `R$${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} />
                </Bar>
                <Bar dataKey="Comissão" stackId="fin" fill="#e74c3c" radius={[4, 4, 0, 0]} maxBarSize={45}>
                  <LabelList dataKey="Comissão" position="center" fontSize={9} fill="#3a0e0a" fontWeight={600} formatter={(v: any) => `R$${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Taxa de Ocupação Mensal */}
        <div className="card">
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Users size={18} color="var(--color-blue)" /> Evolução da Taxa de Ocupação
          </h3>
          <div style={{ width: '100%', height: 230 }}>
            <ResponsiveContainer>
              <LineChart data={ocupacaoMensal} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d1f20" vertical={false} />
                <XAxis dataKey="name" stroke="#7a6060" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#7a6060" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "rgba(22,15,16,0.9)", border: "1px solid var(--color-border)", borderRadius: "8px" }} formatter={(value: any) => [`${value}%`, 'Ocupação Média']} />
                <Line type="monotone" dataKey="Ocupação %" stroke="#3498db" strokeWidth={3} dot={{ fill: '#3498db', r: 4 }} activeDot={{ r: 6 }}
                  label={{ position: 'top', fontSize: 10, fill: '#3498db', formatter: (v: any) => `${v}%` }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ranking de Produtos */}
        <div className="card">
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1.5rem" }}>
            Top 5 Produtos Mais Vendidos
          </h3>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={topProdutos}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="Faturado"
                  stroke="none"
                  label={renderPieLabel}
                  labelLine={{ stroke: "#7a6060", strokeWidth: 1 }}
                >
                  {topProdutos.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ background: "rgba(22,15,16,0.9)", border: "1px solid #2d1f20", borderRadius: "8px" }}
                  formatter={(value: any) => [brl(Number(value)), 'Faturado']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {topProdutos.map((s, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS[i % COLORS.length] }} />
                  <span style={{ color: "var(--color-cream-dim)" }}>{s.name}</span>
                </div>
                <div style={{ display: "flex", gap: "1rem" }}>
                  <span style={{ color: "var(--color-muted)" }}>{s.Quantidade} un</span>
                  <span style={{ fontWeight: "bold" }}>{brl(s.Faturado)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
