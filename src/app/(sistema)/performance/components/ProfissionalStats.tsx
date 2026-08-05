"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import { User, Scissors, DollarSign, Percent, Target, TrendingUp } from "lucide-react";
import {
  DesempenhoProfissional, getProfissionaisUnicos, catalogoServicos, catalogoProdutos, TaxaOcupacaoImportada, normalizeProfName
} from "@/lib/performance-data";
import { ConfigMetasType } from "./ConfigMetas";

const parseMesAno = (dateStr: string): string => {
  if (!dateStr) return "";
  const clean = dateStr.split(" ")[0];
  if (clean.includes("/")) {
    const parts = clean.split("/");
    if (parts.length === 3) {
      return `${parts[1]}/${parts[2]}`;
    }
  }
  if (clean.includes("-")) {
    const parts = clean.split("-");
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[1]}/${parts[0]}`;
      } else {
        return `${parts[1]}/${parts[2]}`;
      }
    }
  }
  return "";
};

interface ProfissionalStatsProps {
  data: DesempenhoProfissional[];
  ocupacao: TaxaOcupacaoImportada[];
  metas?: ConfigMetasType;
  initialSelectedProf?: string;
  onProfChange?: (prof: string) => void;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ProfissionalStats({ data, ocupacao, metas, initialSelectedProf, onProfChange }: ProfissionalStatsProps) {
  const profissionais = getProfissionaisUnicos(data, ocupacao);
  const [selectedProf, setSelectedProf] = useState<string>(initialSelectedProf || profissionais[0] || "");

  // Update local state when parent changes (for when user navigates directly here)
  useEffect(() => {
    if (initialSelectedProf && initialSelectedProf !== selectedProf) {
      setSelectedProf(initialSelectedProf);
    }
  }, [initialSelectedProf]);

  const handleProfChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedProf(val);
    if (onProfChange) onProfChange(val);
  };

  const profData = useMemo(() => {
    return data.filter(d => d.profissional === selectedProf);
  }, [data, selectedProf]);

  const nomeProdutos = useMemo(() => new Set(catalogoProdutos.map(p => p.nome.toLowerCase())), []);

  // Todos os meses com dados (comissão ou ocupação) para este profissional, do mais recente ao mais antigo
  const mesesDisponiveis = useMemo(() => {
    const normalizedProf = normalizeProfName(selectedProf);
    const setMeses = new Set<string>();

    profData.forEach(d => {
      const mesAno = parseMesAno(d.data);
      if (mesAno) setMeses.add(mesAno);
    });

    ocupacao.forEach(t => {
      if (normalizeProfName(t.profissional) === normalizedProf && t.mesAno) setMeses.add(t.mesAno);
    });

    return Array.from(setMeses).sort((a, b) => {
      const [m1, y1] = a.split("/");
      const [m2, y2] = b.split("/");
      return (parseInt(y2, 10) * 12 + parseInt(m2, 10)) - (parseInt(y1, 10) * 12 + parseInt(m1, 10));
    });
  }, [profData, selectedProf, ocupacao]);

  // Mês selecionado pra exibição — começa no mais recente, mas o usuário pode trocar
  const [selectedMesAno, setSelectedMesAno] = useState<string>(() => mesesDisponiveis[0] || "");

  // Se o profissional mudar (ou a lista de meses mudar) e o mês selecionado não existir mais pra ele, volta pro mais recente
  if (mesesDisponiveis.length > 0 && !mesesDisponiveis.includes(selectedMesAno)) {
    setSelectedMesAno(mesesDisponiveis[0]);
  }

  // Filtra dados do profissional para usar apenas os do mês selecionado nos cartões principais
  const currentMonthData = useMemo(() => {
    if (!selectedMesAno) return profData;
    return profData.filter(d => parseMesAno(d.data) === selectedMesAno);
  }, [profData, selectedMesAno]);

  // Classificação simples: produto = item cujo nome consta no catálogo de produtos; todo o resto é serviço
  const isProduto = (item: string) => nomeProdutos.has(item.toLowerCase().trim());

  const faturadoServicos = currentMonthData.filter(d => !isProduto(d.item)).reduce((acc, curr) => acc + curr.valorBruto, 0);
  const faturadoProdutos = currentMonthData.filter(d => isProduto(d.item)).reduce((acc, curr) => acc + curr.valorBruto, 0);
  const faturado = faturadoServicos + faturadoProdutos;
  
  const comissaoServicos = currentMonthData.filter(d => !isProduto(d.item)).reduce((acc, curr) => acc + curr.valorComissao, 0);
  const comissaoProdutos = currentMonthData.filter(d => isProduto(d.item)).reduce((acc, curr) => acc + curr.valorComissao, 0);
  const comissao = comissaoServicos + comissaoProdutos;
  const totalServicos = currentMonthData.length;
  const ticketMedio = totalServicos > 0 ? faturado / totalServicos : 0;
  const taxaComissaoMedia = faturado > 0 ? (comissao / faturado) * 100 : 0;

  // Novos KPIs baseados no mês atual
  const clientesUnicos = Array.from(
    new Set(currentMonthData.filter(d => d.cliente && d.cliente !== "Cliente Avulso").map(d => d.cliente.trim().toLowerCase()))
  ).length || 1;
  
  const cortesRealizados = currentMonthData.filter(d => d.item.toLowerCase().includes("corte")).length;
  
  // Subserviços = estão no catálogo de serviços mas NÃO são cortes
  const servicosExtras = currentMonthData.filter(d => !d.item.toLowerCase().includes("corte") && !!catalogoServicos[d.item]).length;
  const conversaoExtra = (servicosExtras / clientesUnicos) * 100;
  
  // Produtos = estão no catálogo de produtos (busca pelo nome)
  const produtosVendidos = currentMonthData.filter(d => nomeProdutos.has(d.item.toLowerCase()) || (!catalogoServicos[d.item] && !d.item.toLowerCase().includes("corte"))).length;
  const conversaoProduto = (produtosVendidos / clientesUnicos) * 100;
  
  const ticketMedioCliente = faturado / clientesUnicos;
  const servicosPorCliente = totalServicos / clientesUnicos;
  
  const normalizedProf = normalizeProfName(selectedProf);
  const currentProfMeta = metas ? metas[normalizedProf] : undefined;
  const metaServicosVal = currentProfMeta ? currentProfMeta.metaServicos : 0;
  const metaProdutosVal = currentProfMeta ? currentProfMeta.metaProdutos : 0;
  const faltaServicosCard = metaServicosVal > 0 ? metaServicosVal - faturadoServicos : 0;
  const faltaProdutosCard = metaProdutosVal > 0 ? metaProdutosVal - faturadoProdutos : 0;

  const importedOcupacao = ocupacao.find(t => normalizeProfName(t.profissional) === normalizedProf && t.mesAno === selectedMesAno) || ocupacao.find(t => normalizeProfName(t.profissional) === normalizedProf);
  const taxaOcupacao = importedOcupacao ? importedOcupacao.taxaOcupacao : 0;
  const taxaOcupacaoComBloqueios = importedOcupacao ? importedOcupacao.taxaOcupacaoComBloqueios : 0;
  
  const displayHorasTrabalhadas = importedOcupacao ? importedOcupacao.tempoAtendimentoStr : `0h trab.`;
  const displayHorasDisponiveis = importedOcupacao ? importedOcupacao.tempoJornadaStr : `0h disp.`;
  const displayHorasBloqueadas = importedOcupacao ? importedOcupacao.tempoBloqueadoStr : `0h bloq.`;

  const ganhoPotencial = taxaOcupacao > 0 ? faturado / taxaOcupacao : faturado;
  const comissaoPotencial = taxaOcupacao > 0 ? comissao / taxaOcupacao : comissao;

  // Quebra por Semana do Mês (Serviços x Produtos)
  const dadosPorSemana = useMemo(() => {
    const semanas: Record<string, { servicos: number, produtos: number, qteServicos: number, qteProdutos: number }> = {
      "Semana 1 (01-07)": { servicos: 0, produtos: 0, qteServicos: 0, qteProdutos: 0 },
      "Semana 2 (08-14)": { servicos: 0, produtos: 0, qteServicos: 0, qteProdutos: 0 },
      "Semana 3 (15-21)": { servicos: 0, produtos: 0, qteServicos: 0, qteProdutos: 0 },
      "Semana 4 (22+)": { servicos: 0, produtos: 0, qteServicos: 0, qteProdutos: 0 },
    };

    currentMonthData.forEach(d => {
      if (!d.data) return;
      const dayStr = d.data.split(" ")[0]; // DD/MM/YYYY
      const parts = dayStr.split("/");
      if (parts.length >= 1) {
        const day = parseInt(parts[0], 10);
        let key = "Semana 4 (22+)";
        if (day <= 7) key = "Semana 1 (01-07)";
        else if (day <= 14) key = "Semana 2 (08-14)";
        else if (day <= 21) key = "Semana 3 (15-21)";

        const prod = isProduto(d.item);
        if (prod) {
          semanas[key].produtos += d.valorBruto;
          semanas[key].qteProdutos += 1;
        } else {
          semanas[key].servicos += d.valorBruto;
          semanas[key].qteServicos += 1;
        }
      }
    });

    return Object.entries(semanas).map(([nome, vals]) => ({
      name: nome.split(" ")[0] + " " + nome.split(" ")[1], // ex: "Semana 1"
      labelCompleto: nome,
      "Serviços (R$)": vals.servicos,
      "Produtos (R$)": vals.produtos,
      "QtdServiços": vals.qteServicos,
      "QtdProdutos": vals.qteProdutos,
    }));
  }, [currentMonthData, isProduto]);

  // Evolução Diária (simulando, como só temos algumas datas, agrupamos por dia)
  const evolucaoDiaria = useMemo(() => {
    const map: Record<string, { faturado: number, comissao: number }> = {};
    profData.forEach(d => {
      const day = d.data.split(" ")[0]; // DD/MM/YYYY
      if (!map[day]) map[day] = { faturado: 0, comissao: 0 };
      map[day].faturado += d.valorBruto;
      map[day].comissao += d.valorComissao;
    });
    return Object.entries(map).map(([day, values]) => ({
      name: day.substring(0, 5), // DD/MM
      ...values
    })).sort((a, b) => {
      const [d1, m1] = a.name.split("/");
      const [d2, m2] = b.name.split("/");
      return parseInt(m1)*100+parseInt(d1) - (parseInt(m2)*100+parseInt(d2));
    });
  }, [profData]);

  // Serviços mais realizados por ele
  const servicosProf = useMemo(() => {
    const counts: Record<string, number> = {};
    profData.forEach(d => counts[d.item] = (counts[d.item] || 0) + 1);
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count).slice(0, 4);
  }, [profData]);

  // Faturamento + Comissão por Mês (só deste profissional)
  const faturamentoMensalProf = useMemo(() => {
    const records: Record<string, { Faturamento: number, Comissão: number }> = {};
    profData.forEach(d => {
      const mesAno = parseMesAno(d.data);
      if (mesAno) {
        if (!records[mesAno]) records[mesAno] = { Faturamento: 0, Comissão: 0 };
        records[mesAno].Faturamento += d.valorBruto;
        records[mesAno].Comissão += d.valorComissao;
      }
    });
    return Object.entries(records).map(([name, vals]) => ({ name, ...vals })).sort((a, b) => {
      const [m1, y1] = a.name.split("/");
      const [m2, y2] = b.name.split("/");
      return new Date(Number(y1), Number(m1) - 1).getTime() - new Date(Number(y2), Number(m2) - 1).getTime();
    });
  }, [profData]);

  // Evolução Mensal do Profissional (Serviços x Produtos x Comissões)
  const evolucaoServicosProdutosMensalProf = useMemo(() => {
    const records: Record<string, { servicos: number, produtos: number, comissao: number }> = {};
    profData.forEach(d => {
      const mesAno = parseMesAno(d.data);
      if (mesAno) {
        if (!records[mesAno]) records[mesAno] = { servicos: 0, produtos: 0, comissao: 0 };
        if (isProduto(d.item)) {
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
  }, [profData, isProduto]);

  // Taxa de Ocupação Mensal deste profissional
  const ocupacaoMensalProf = useMemo(() => {
    const normalizedProf = normalizeProfName(selectedProf);
    return ocupacao
      .filter(t => normalizeProfName(t.profissional) === normalizedProf)
      .map(t => ({
        name: t.mesAno || "Geral",
        "Ocupação %": Number((t.taxaOcupacao * 100).toFixed(1)),
        "c/ Bloqueios %": Number((t.taxaOcupacaoComBloqueios * 100).toFixed(1))
      }))
      .sort((a, b) => {
        if (a.name === "Geral") return -1;
        if (b.name === "Geral") return 1;
        const [m1, y1] = a.name.split("/");
        const [m2, y2] = b.name.split("/");
        return new Date(Number(y1), Number(m1) - 1).getTime() - new Date(Number(y2), Number(m2) - 1).getTime();
      });
  }, [selectedProf, ocupacao]);

  // Top Produtos deste profissional
  const topProdutosProf = useMemo(() => {
    const produtosData = profData.filter(d => nomeProdutos.has(d.item.toLowerCase()) || (!catalogoServicos[d.item] && !d.item.toLowerCase().includes("corte")));
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
  }, [profData, nomeProdutos]);

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

  if (!selectedProf) {
    return <div style={{ color: "var(--color-muted)" }}>Nenhum profissional encontrado.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      
      {/* Seletor de Profissional */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <User size={20} color="var(--color-gold)" />
        <span style={{ fontWeight: 600, color: "var(--color-cream)" }}>Profissional:</span>
        <select 
          value={selectedProf} 
          onChange={handleProfChange}
          style={{ 
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", 
            padding: "0.5rem 1rem", borderRadius: "4px", color: "white", outline: "none"
          }}
        >
          {profissionais.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        {mesesDisponiveis.length > 0 && (
          <div style={{
            marginLeft: "auto", display: "flex", flexDirection: "column", gap: "0.2rem",
            background: "rgba(212, 175, 140, 0.1)", border: "1px solid rgba(212,175,140,0.25)",
            padding: "0.4rem 0.75rem", borderRadius: "10px",
          }}>
            <span style={{ fontSize: "0.7rem", color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Exibindo dados de:
            </span>
            <select
              value={selectedMesAno}
              onChange={e => setSelectedMesAno(e.target.value)}
              style={{
                background: "transparent", border: "none", color: "var(--color-gold)",
                fontWeight: 700, fontSize: "0.9rem", outline: "none", cursor: "pointer", padding: 0,
              }}
            >
              {mesesDisponiveis.map(m => (
                <option key={m} value={m} style={{ background: "#160f10", color: "#fff" }}>{m}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="divider-text">Indicadores do Mês</div>

      {/* Indicadores Individuais */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ color: "var(--color-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Total Gerado (Bruto)</div>
          <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "var(--color-gold)" }}>{brl(faturado)}</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ color: "var(--color-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Total Gerado (Serviços)</div>
          <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "var(--color-gold)" }}>{brl(faturadoServicos)}</div>
          {metaServicosVal > 0 && (
            <div style={{ fontSize: "0.75rem", marginTop: "0.4rem", color: faltaServicosCard <= 0 ? "var(--color-success)" : "var(--color-muted-2)" }}>
              {faltaServicosCard <= 0 ? "Meta Atingida! 🎉" : `(Faltam ${brl(faltaServicosCard)} para a meta)`}
            </div>
          )}
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ color: "var(--color-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Total Gerado (Produtos)</div>
          <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "var(--color-gold)" }}>{brl(faturadoProdutos)}</div>
          {metaProdutosVal > 0 && (
            <div style={{ fontSize: "0.75rem", marginTop: "0.4rem", color: faltaProdutosCard <= 0 ? "var(--color-success)" : "var(--color-muted-2)" }}>
              {faltaProdutosCard <= 0 ? "Meta Atingida! 🎉" : `(Faltam ${brl(faltaProdutosCard)} para a meta)`}
            </div>
          )}
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ color: "var(--color-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Comissão (Serviços)</div>
          <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "var(--color-success)" }}>{brl(comissaoServicos)}</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ color: "var(--color-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Comissão (Produtos)</div>
          <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "var(--color-success)" }}>{brl(comissaoProdutos)}</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ color: "var(--color-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Comissão (Total)</div>
          <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "var(--color-success)" }}>{brl(comissao)}</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ color: "var(--color-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Ticket Médio (Serviço)</div>
          <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "var(--color-info)" }}>{brl(ticketMedio)}</div>
        </div>
      </div>

      {/* Novos KPIs de Engajamento e Vendas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1.5rem" }}>
        <div className="card" style={{ textAlign: "center", borderTop: "3px solid var(--color-info)" }}>
          <div style={{ color: "var(--color-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Clientes Atendidos</div>
          <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "var(--color-cream)" }}>{profData.length === 0 ? 0 : clientesUnicos}</div>
        </div>
        <div className="card" style={{ textAlign: "center", borderTop: "3px solid var(--color-gold)" }}>
          <div style={{ color: "var(--color-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Cortes Realizados</div>
          <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "var(--color-cream)" }}>{cortesRealizados}</div>
        </div>
        <div className="card" style={{ textAlign: "center", borderTop: "3px solid var(--color-gold-dim)" }}>
          <div style={{ color: "var(--color-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Ticket Médio / Cliente</div>
          <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "var(--color-gold-bright)" }}>{profData.length === 0 ? brl(0) : brl(ticketMedioCliente)}</div>
        </div>
        <div className="card" style={{ textAlign: "center", borderTop: "3px solid var(--color-success)" }}>
          <div style={{ color: "var(--color-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Conversão Extra</div>
          <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "var(--color-success)" }}>{profData.length === 0 ? 0 : conversaoExtra.toFixed(1)}%</div>
          <div style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>{servicosExtras} extras realizados</div>
        </div>
        <div className="card" style={{ textAlign: "center", borderTop: "3px solid var(--color-danger)" }}>
          <div style={{ color: "var(--color-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Conversão Produtos</div>
          <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "var(--color-danger)" }}>{profData.length === 0 ? 0 : conversaoProduto.toFixed(1)}%</div>
          <div style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>{produtosVendidos} produtos vendidos</div>
        </div>
        <div className="card" style={{ textAlign: "center", borderTop: "3px solid #8e44ad" }}>
          <div style={{ color: "var(--color-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Serviços / Cliente</div>
          <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "#9b59b6" }}>{profData.length === 0 ? 0 : servicosPorCliente.toFixed(2)}</div>
        </div>
      </div>

      <div className="divider-text">Ocupação</div>

      {/* Indicadores de Ocupação */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem" }}>
        <div className="card" style={{ textAlign: "center", background: "rgba(52, 152, 219, 0.05)", borderColor: "rgba(52, 152, 219, 0.2)" }}>
          <div style={{ color: "var(--color-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Taxa de Ocupação (Sem Bloqueios)</div>
          <p style={{ fontSize: "2.5rem", fontWeight: 700, margin: "1rem 0", color: "var(--color-blue)" }}>
            {importedOcupacao ? (taxaOcupacao * 100).toFixed(1) + "%" : "N/D"}
          </p>
          <p style={{ fontSize: "0.85rem", color: "var(--color-muted)", opacity: 0.8 }}>
            Tempo de Atendimento: {displayHorasTrabalhadas}
          </p>
        </div>
        <div className="card" style={{ textAlign: "center", background: "rgba(155, 89, 182, 0.05)", borderColor: "rgba(155, 89, 182, 0.2)" }}>
          <div style={{ color: "var(--color-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Taxa de Ocupação (Com Bloqueios)</div>
          <p style={{ fontSize: "2.5rem", fontWeight: 700, margin: "1rem 0", color: "#9b59b6" }}>
            {importedOcupacao ? (taxaOcupacaoComBloqueios * 100).toFixed(1) + "%" : "N/D"}
          </p>
          <p style={{ fontSize: "0.85rem", color: "var(--color-muted)", opacity: 0.8 }}>
            Tempo Bloqueado: {displayHorasBloqueadas}
          </p>
        </div>
        <div className="card" style={{ textAlign: "center", background: "rgba(46, 204, 113, 0.05)", borderColor: "rgba(46, 204, 113, 0.2)" }}>
          <div style={{ color: "var(--color-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Comissão Potencial (100% Ocupação)</div>
          <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "#2ecc71" }}>{importedOcupacao ? brl(comissaoPotencial) : "N/D"}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginTop: "4px" }}>
            Fat. Potencial: {importedOcupacao ? brl(ganhoPotencial) : "N/D"} | Jornada: {displayHorasDisponiveis}
          </div>
        </div>
      </div>

      {/* Seção de Metas e Bônus */}
      {metas && metas[normalizeProfName(selectedProf)] && (() => {
        const m = metas[normalizeProfName(selectedProf)];
        
        // 1. Serviços
        const progServicos = m.metaServicos > 0 ? (faturadoServicos / m.metaServicos) * 100 : 0;
        const faltaServicos = m.metaServicos - faturadoServicos;
        
        // 2. Produtos
        const progProdutos = m.metaProdutos > 0 ? (faturadoProdutos / m.metaProdutos) * 100 : 0;
        const faltaProdutos = m.metaProdutos - faturadoProdutos;
        
        // 3. Ticket Médio
        const progTicket = m.metaTicket > 0 ? (ticketMedio / m.metaTicket) * 100 : 0;
        const faltaTicket = m.metaTicket - ticketMedio;

        return (
          <div style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Target size={18} color="var(--color-gold)" /> Acompanhamento de Metas ({selectedMesAno})
            </h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
              
              {/* Meta Serviços */}
              <div className="card-gold" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "1.25rem", position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Target size={18} color="var(--color-gold)" />
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--color-gold)" }}>Meta de Serviços</span>
                  </div>
                  <span style={{ fontSize: "0.75rem", background: "rgba(0,0,0,0.4)", padding: "2px 8px", borderRadius: "4px", color: "var(--color-muted)" }}>
                    Alvo: {brl(m.metaServicos)}
                  </span>
                </div>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <h3 style={{ fontSize: "2rem", margin: 0, color: "var(--color-cream)", fontWeight: 800 }}>
                    {progServicos.toFixed(1)}%
                  </h3>
                  <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontSize: "0.75rem", color: progServicos >= 100 ? "var(--color-success)" : "var(--color-muted-2)" }}>
                      {progServicos >= 100 ? "Meta Atingida! 🎉" : `Falta ${brl(faltaServicos)}`}
                    </span>
                    {m.bonusServicos > 0 && (
                      <span style={{ fontSize: "0.7rem", color: "var(--color-gold)" }}>
                        Bônus: {brl(m.bonusServicos)}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ height: "6px", background: "rgba(0,0,0,0.3)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(progServicos, 100)}%`, height: "100%", background: "var(--color-gold)", transition: "width 0.5s" }} />
                </div>
              </div>

              {/* Meta Produtos */}
              <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "1.25rem", borderColor: "rgba(52, 152, 219, 0.2)", background: "rgba(52, 152, 219, 0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Target size={18} color="#3498db" />
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#3498db" }}>Meta de Produtos</span>
                  </div>
                  <span style={{ fontSize: "0.75rem", background: "rgba(0,0,0,0.4)", padding: "2px 8px", borderRadius: "4px", color: "var(--color-muted)" }}>
                    Alvo: {brl(m.metaProdutos)}
                  </span>
                </div>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <h3 style={{ fontSize: "2rem", margin: 0, color: "var(--color-cream)", fontWeight: 800 }}>
                    {progProdutos.toFixed(1)}%
                  </h3>
                  <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontSize: "0.75rem", color: progProdutos >= 100 ? "var(--color-success)" : "var(--color-muted-2)" }}>
                      {progProdutos >= 100 ? "Meta Atingida! 🎉" : `Falta ${brl(faltaProdutos)}`}
                    </span>
                    {m.bonusProdutos > 0 && (
                      <span style={{ fontSize: "0.7rem", color: "#3498db" }}>
                        Bônus: {brl(m.bonusProdutos)}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ height: "6px", background: "rgba(0,0,0,0.3)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(progProdutos, 100)}%`, height: "100%", background: "#3498db", transition: "width 0.5s" }} />
                </div>
              </div>

              {/* Meta Ticket Médio */}
              <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "1.25rem", borderColor: "rgba(46, 204, 113, 0.2)", background: "rgba(46, 204, 113, 0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Target size={18} color="#2ecc71" />
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#2ecc71" }}>Meta de Ticket Médio</span>
                  </div>
                  <span style={{ fontSize: "0.75rem", background: "rgba(0,0,0,0.4)", padding: "2px 8px", borderRadius: "4px", color: "var(--color-muted)" }}>
                    Alvo: {brl(m.metaTicket)}
                  </span>
                </div>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <h3 style={{ fontSize: "2rem", margin: 0, color: "var(--color-cream)", fontWeight: 800 }}>
                    {progTicket.toFixed(1)}%
                  </h3>
                  <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontSize: "0.75rem", color: progTicket >= 100 ? "var(--color-success)" : "var(--color-muted-2)" }}>
                      {progTicket >= 100 ? "Meta Atingida! 🎉" : `Falta ${brl(faltaTicket)}`}
                    </span>
                    {m.bonusTicket > 0 && (
                      <span style={{ fontSize: "0.7rem", color: "#2ecc71" }}>
                        Bônus: {brl(m.bonusTicket)}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ height: "6px", background: "rgba(0,0,0,0.3)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(progTicket, 100)}%`, height: "100%", background: "#2ecc71", transition: "width 0.5s" }} />
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      <div className="divider-text">Gráficos e Histórico</div>

      {/* Gráficos Individuais */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "1.5rem" }}>

        {/* Evolução Diária */}
        <div className="card">
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1.5rem" }}>Evolução de Ganhos</h3>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <LineChart data={evolucaoDiaria} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d1f20" vertical={false} />
                <XAxis dataKey="name" stroke="#7a6060" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#7a6060" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `R$${val}`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="faturado" name="Faturado" stroke="#d4af8c" strokeWidth={3} dot={{ r: 4, fill: "#d4af8c", strokeWidth: 0 }} />
                <Line type="monotone" dataKey="comissao" name="Comissão" stroke="#2ecc71" strokeWidth={3} dot={{ r: 4, fill: "#2ecc71", strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Mais realizados */}
        <div className="card">
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Scissors size={18} color="var(--color-gold)" /> Serviços Principais
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {servicosProf.map((s, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "0.5rem", borderBottom: "1px solid var(--color-border)" }}>
                <span style={{ fontSize: "0.9rem", color: "var(--color-cream-dim)" }}>{s.name}</span>
                <span style={{ fontWeight: "bold", background: "var(--color-surface-2)", padding: "2px 8px", borderRadius: "10px", fontSize: "0.8rem" }}>{s.count}x</span>
              </div>
            ))}
            {servicosProf.length === 0 && (
              <div style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>Nenhum serviço registrado.</div>
            )}
          </div>
        </div>

      </div>

      {/* GRÁFICO SEMANAL (SERVIÇOS X PRODUTOS POR SEMANA) */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Faturamento Semanal: Serviços x Produtos ({selectedMesAno})</h3>
            <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", margin: "4px 0 0 0" }}>Comparativo do faturamento gerado por semana do mês</p>
          </div>
        </div>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={dadosPorSemana} margin={{ top: 25, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d1f20" vertical={false} />
              <XAxis dataKey="name" stroke="#7a6060" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#7a6060" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `R$${val}`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: "10px" }} />
              <Bar dataKey="Serviços (R$)" fill="#d4af8c" radius={[4, 4, 0, 0]} maxBarSize={45}
                label={{ position: 'top', fontSize: 10, fill: '#d4af8c', formatter: (v: any) => v > 0 ? `R$${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '' }}
              />
              <Bar dataKey="Produtos (R$)" fill="#3498db" radius={[4, 4, 0, 0]} maxBarSize={45}
                label={{ position: 'top', fontSize: 10, fill: '#3498db', formatter: (v: any) => v > 0 ? `R$${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '' }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* GRÁFICO HISTÓRICO RETROATIVO MENSAL (SERVIÇOS X PRODUTOS X COMISSÃO) */}
      {evolucaoServicosProdutosMensalProf.length > 0 && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <TrendingUp size={18} color="var(--color-gold)" /> Evolução Mensal Retroativa: Serviços, Produtos e Comissões ({normalizeProfName(selectedProf)})
              </h3>
              <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", margin: "4px 0 0 0" }}>Histórico retroativo de faturamento de serviços, produtos vendidos e comissões geradas por mês</p>
            </div>
          </div>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={evolucaoServicosProdutosMensalProf} margin={{ top: 25, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d1f20" vertical={false} />
                <XAxis dataKey="name" stroke="#7a6060" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#7a6060" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `R$${val}`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: "10px" }} />
                <Bar dataKey="Serviços (R$)" fill="#d4af8c" radius={[4, 4, 0, 0]} maxBarSize={45}
                  label={{ position: 'top', fontSize: 10, fill: '#d4af8c', formatter: (v: any) => v > 0 ? `R$${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '' }}
                />
                <Bar dataKey="Produtos (R$)" fill="#3498db" radius={[4, 4, 0, 0]} maxBarSize={45}
                  label={{ position: 'top', fontSize: 10, fill: '#3498db', formatter: (v: any) => v > 0 ? `R$${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '' }}
                />
                <Bar dataKey="Comissão (R$)" fill="#2ecc71" radius={[4, 4, 0, 0]} maxBarSize={45}
                  label={{ position: 'top', fontSize: 10, fill: '#2ecc71', formatter: (v: any) => v > 0 ? `R$${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* NOVOS GRÁFICOS HISTÓRICOS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem" }}>

        {/* Histórico Mensal: Faturamento x Comissão */}
        {faturamentoMensalProf.length > 0 && (
          <div className="card">
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1.5rem" }}>Histórico Mensal (Financeiro)</h3>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <BarChart data={faturamentoMensalProf} margin={{ top: 25, right: 0, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d1f20" vertical={false} />
                  <XAxis dataKey="name" stroke="#7a6060" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#7a6060" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="Faturamento" fill="#d4af8c" radius={[4, 4, 0, 0]} maxBarSize={40}
                    label={{ position: 'top', fontSize: 10, fill: '#d4af8c', formatter: (v: any) => `R$${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` }}
                  />
                  <Bar dataKey="Comissão" fill="#2ecc71" radius={[4, 4, 0, 0]} maxBarSize={40}
                    label={{ position: 'top', fontSize: 10, fill: '#2ecc71', formatter: (v: any) => `R$${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Evolução da Taxa de Ocupação */}
        {ocupacaoMensalProf.length > 0 && (
          <div className="card">
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1.5rem" }}>Evolução de Ocupação</h3>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <LineChart data={ocupacaoMensalProf} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d1f20" vertical={false} />
                  <XAxis dataKey="name" stroke="#7a6060" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#7a6060" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: "rgba(22,15,16,0.9)", border: "1px solid var(--color-border)", borderRadius: "8px" }} formatter={(v: any) => [`${v}%`]} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                  <Line type="monotone" dataKey="Ocupação %" stroke="#3498db" strokeWidth={2} dot={{ fill: '#3498db', r: 3 }} />
                  <Line type="monotone" dataKey="c/ Bloqueios %" stroke="#9b59b6" strokeWidth={2} dot={{ fill: '#9b59b6', r: 3 }} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Top Produtos do Profissional */}
        {topProdutosProf.length > 0 && (
          <div className="card">
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1.5rem" }}>Top Produtos Vendidos</h3>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={topProdutosProf}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={85}
                    paddingAngle={4}
                    dataKey="Faturado"
                    stroke="none"
                  >
                    {topProdutosProf.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={['#d4af8c','#3498db','#2ecc71','#e74c3c','#9b59b6'][index % 5]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "rgba(22,15,16,0.9)", border: "1px solid #2d1f20", borderRadius: "8px" }} formatter={(v: any) => [brl(Number(v)), 'Faturado']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.5rem" }}>
              {topProdutosProf.map((s, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: ['#d4af8c','#3498db','#2ecc71','#e74c3c','#9b59b6'][i % 5] }} />
                    <span style={{ color: "var(--color-cream-dim)" }}>{s.name}</span>
                  </div>
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <span style={{ color: "var(--color-muted)" }}>{s.Quantidade} un</span>
                    <span style={{ fontWeight: "bold" }}>{brl(s.Faturado)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
