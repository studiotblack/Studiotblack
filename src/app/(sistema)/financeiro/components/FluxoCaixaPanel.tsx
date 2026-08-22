"use client";

import { useState, useEffect, useMemo } from "react";
import { ArrowUpRight, ArrowDownRight, Landmark, Calendar, Pencil, AlertTriangle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { ContaBancaria, Agendamento } from "@/lib/financeiro-data";
import { statusAgendamento } from "@/lib/financeiro-data";
import type { DreLinhaImportada } from "@/lib/dre-data";
import { computeIndicadoresDreMes, MESES_ABREV } from "@/lib/dre-data";

interface BaixaComTipo {
  id: string;
  agendamentoId: string;
  valor: number;
  data: string;
  contaBancariaId: string;
  agendamentoTipo: "pagar" | "receber";
}

interface TransferenciaRow {
  id: string;
  contaOrigemId: string;
  contaDestinoId: string;
  valor: number;
  data: string;
}

interface FluxoCaixaPanelProps {
  dreLinhas: DreLinhaImportada[];
  anoDre: number;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR");

export default function FluxoCaixaPanel({ dreLinhas, anoDre }: FluxoCaixaPanelProps) {
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [baixas, setBaixas] = useState<BaixaComTipo[]>([]);
  const [transferencias, setTransferencias] = useState<TransferenciaRow[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);

  // Meta de faturamento mensal do negócio (card "Receita do Mês")
  const [meta, setMeta] = useState(0);
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [metaInput, setMetaInput] = useState("");

  useEffect(() => {
    const carregar = async () => {
      setLoading(true);
      try {
        const [rContas, rBaixas, rTransf, rPagar, rReceber, rMeta] = await Promise.all([
          fetch("/api/financeiro/contas-bancarias"),
          fetch("/api/financeiro/baixas"),
          fetch("/api/financeiro/transferencias"),
          fetch("/api/financeiro/agendamentos?tipo=pagar"),
          fetch("/api/financeiro/agendamentos?tipo=receber"),
          fetch("/api/financeiro/meta"),
        ]);
        setContas(rContas.ok ? await rContas.json() : []);
        setBaixas(rBaixas.ok ? await rBaixas.json() : []);
        setTransferencias(rTransf.ok ? await rTransf.json() : []);
        const pagar = rPagar.ok ? await rPagar.json() : [];
        const receber = rReceber.ok ? await rReceber.json() : [];
        setAgendamentos([...pagar, ...receber]);
        const metaData = rMeta.ok ? await rMeta.json() : { metaReceitaMensal: 0 };
        setMeta(metaData.metaReceitaMensal || 0);
      } catch (err) {
        console.error("Erro ao carregar fluxo de caixa:", err);
      } finally {
        setLoading(false);
      }
    };
    carregar();
  }, []);

  const abrirEdicaoMeta = () => {
    setMetaInput(meta > 0 ? String(meta) : "");
    setEditandoMeta(true);
  };

  const salvarMeta = async () => {
    const valor = parseFloat(metaInput.replace(/\./g, "").replace(",", "."));
    if (isNaN(valor) || valor < 0) {
      setEditandoMeta(false);
      return;
    }
    try {
      const res = await fetch("/api/financeiro/meta", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metaReceitaMensal: valor }),
      });
      if (res.ok) {
        const data = await res.json();
        setMeta(data.metaReceitaMensal);
      }
    } catch (err) {
      console.error("Erro ao salvar meta:", err);
    } finally {
      setEditandoMeta(false);
    }
  };

  const saldoPorConta = useMemo(() => {
    return contas.map(conta => {
      // Conta conectada ao Sicoob: confia no saldo real puxado do banco em vez de calcular
      // localmente (evita divergência se alguma baixa não foi lançada no sistema).
      if (conta.sicoobClientId && conta.saldoSicoob !== undefined && conta.saldoSicoob !== null) {
        return { ...conta, saldoAtual: conta.saldoSicoob, saldoReal: true as const };
      }
      const entradas = baixas.filter(b => b.contaBancariaId === conta.id && b.agendamentoTipo === "receber").reduce((a, b) => a + b.valor, 0);
      const saidas = baixas.filter(b => b.contaBancariaId === conta.id && b.agendamentoTipo === "pagar").reduce((a, b) => a + b.valor, 0);
      const transfRecebidas = transferencias.filter(t => t.contaDestinoId === conta.id).reduce((a, t) => a + t.valor, 0);
      const transfEnviadas = transferencias.filter(t => t.contaOrigemId === conta.id).reduce((a, t) => a + t.valor, 0);
      const saldoAtual = conta.saldoInicial + entradas - saidas + transfRecebidas - transfEnviadas;
      return { ...conta, saldoAtual, saldoReal: false as const };
    });
  }, [contas, baixas, transferencias]);

  const saldoConsolidado = saldoPorConta.reduce((a, c) => a + c.saldoAtual, 0);

  // ── Receita/Lucro do Mês — lidos direto do DRE real (importado do "Realizado") ──
  const anoAtual = new Date().getFullYear();
  const mesAtualIndex = new Date().getMonth(); // 0 = Jan
  const dreDoAnoCorrente = anoDre === anoAtual;
  const { receitaMes, resultadoOperacionalMes, margemOperacionalMes } = useMemo(
    () => (dreDoAnoCorrente ? computeIndicadoresDreMes(dreLinhas, mesAtualIndex) : { receitaMes: 0, resultadoOperacionalMes: 0, margemOperacionalMes: 0 }),
    [dreLinhas, dreDoAnoCorrente, mesAtualIndex]
  );
  const dreDoMesDisponivel = dreDoAnoCorrente && receitaMes !== 0;
  const progressoMeta = meta > 0 ? Math.min((receitaMes / meta) * 100, 100) : 0;

  // ── Compromissos financeiros dos próximos 60 dias (só contas a PAGAR ainda em aberto) ──
  const { compromissos60Dias, qtdCompromissos60Dias } = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limite = new Date(hoje);
    limite.setDate(hoje.getDate() + 60);

    const pendentes = agendamentos.filter(a => {
      if (a.tipo !== "pagar") return false;
      if (statusAgendamento(a) === "pago") return false;
      const venc = new Date(a.dataVencimento + "T00:00:00");
      return venc >= hoje && venc <= limite;
    });

    return {
      compromissos60Dias: pendentes.reduce((acc, a) => acc + (a.valor - a.valorPago), 0),
      qtdCompromissos60Dias: pendentes.length,
    };
  }, [agendamentos]);

  const caixaLivre = saldoConsolidado - compromissos60Dias;

  const proximosVencimentos = useMemo(() => {
    return agendamentos
      .map(a => ({ ...a, status: statusAgendamento(a) }))
      .filter(a => a.status !== "pago")
      .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento))
      .slice(0, 8);
  }, [agendamentos]);

  const fluxoMensal = useMemo(() => {
    const porMes: Record<string, { entradas: number; saidas: number }> = {};
    baixas.forEach(b => {
      const mesAno = b.data.slice(0, 7); // YYYY-MM
      if (!porMes[mesAno]) porMes[mesAno] = { entradas: 0, saidas: 0 };
      if (b.agendamentoTipo === "receber") porMes[mesAno].entradas += b.valor;
      else porMes[mesAno].saidas += b.valor;
    });
    return Object.entries(porMes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mesAno, v]) => ({
        name: `${mesAno.slice(5, 7)}/${mesAno.slice(0, 4)}`,
        Entradas: v.entradas,
        Saídas: v.saidas,
      }));
  }, [baixas]);

  if (loading) {
    return <div className="card" style={{ textAlign: "center", padding: "2rem", color: "var(--color-muted)" }}>Carregando...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── Visão Geral: os 5 cards que respondem "está sobrando dinheiro?" ────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem" }}>

        {/* 1. Receita do Mês (real x meta) */}
        <div className="kpi-card">
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>
            Receita do Mês ({MESES_ABREV[mesAtualIndex]})
          </span>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "4px 0 0 0", color: "var(--color-gold)" }}>
            {brl(receitaMes)}
          </h2>

          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginTop: "0.4rem" }}>
            {editandoMeta ? (
              <input
                type="text"
                autoFocus
                value={metaInput}
                onChange={e => setMetaInput(e.target.value)}
                onFocus={e => e.target.select()}
                onBlur={salvarMeta}
                onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                placeholder="Meta em R$"
                style={{ width: "100px", fontSize: "0.75rem", padding: "2px 6px", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: "4px", color: "var(--color-cream)" }}
              />
            ) : (
              <span
                onClick={abrirEdicaoMeta}
                style={{ fontSize: "0.75rem", color: "var(--color-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem" }}
                title={meta > 0 ? "Clique para editar a meta de faturamento mensal" : "Clique para definir a meta de faturamento mensal"}
              >
                Meta: {meta > 0 ? brl(meta) : "definir"} <Pencil size={10} />
              </span>
            )}
          </div>

          {meta > 0 && (
            <div style={{ height: "5px", background: "rgba(0,0,0,0.3)", borderRadius: "3px", overflow: "hidden", marginTop: "0.5rem" }}>
              <div style={{ width: `${progressoMeta}%`, height: "100%", background: "var(--color-gold)", transition: "width 0.4s" }} />
            </div>
          )}

          {!dreDoMesDisponivel && (
            <span style={{ fontSize: "0.68rem", color: "var(--color-muted)", marginTop: "0.4rem", display: "block" }}>
              DRE deste mês ainda não importado
            </span>
          )}
        </div>

        {/* 2. Lucro do Mês (e margem) */}
        <div className="kpi-card">
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Lucro do Mês</span>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "4px 0 0 0", color: resultadoOperacionalMes >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
            {brl(resultadoOperacionalMes)}
          </h2>
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>
            Margem: {margemOperacionalMes.toFixed(1)}%
          </span>
        </div>

        {/* 3. Saldo em Caixa Hoje */}
        <div className="kpi-card">
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Saldo em Caixa Hoje</span>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "4px 0 0 0", color: saldoConsolidado >= 0 ? "var(--color-cream)" : "var(--color-danger)" }}>
            {brl(saldoConsolidado)}
          </h2>
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>
            {saldoPorConta.length} conta{saldoPorConta.length !== 1 ? "s" : ""} somada{saldoPorConta.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* 4. Compromissos financeiros dos próximos 60 dias */}
        <div className="kpi-card">
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Compromissos (60 dias)</span>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "4px 0 0 0", color: "var(--color-danger)" }}>
            {brl(compromissos60Dias)}
          </h2>
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>
            {qtdCompromissos60Dias} conta{qtdCompromissos60Dias !== 1 ? "s" : ""} a pagar em aberto
          </span>
        </div>

        {/* 5. Caixa Livre = Saldo em caixa − Compromissos (60 dias) */}
        <div className="kpi-card" style={{
          border: `1px solid ${caixaLivre >= 0 ? "var(--color-success)" : "var(--color-danger)"}`,
          background: caixaLivre >= 0 ? "rgba(46,204,113,0.06)" : "rgba(231,76,60,0.08)",
        }}>
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Caixa Livre</span>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "4px 0 0 0", color: caixaLivre >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
            {brl(caixaLivre)}
          </h2>
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>
            Saldo hoje − compromissos 60 dias
          </span>
          {caixaLivre < 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.7rem", color: "var(--color-danger)", fontWeight: 600, marginTop: "0.35rem" }}>
              <AlertTriangle size={11} /> Compromissos superam o caixa disponível
            </div>
          )}
        </div>
      </div>

      {/* ── Saldo por conta bancária ─────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem" }}>
        {saldoPorConta.map(c => (
          <div key={c.id} className="kpi-card">
            <span style={{ fontSize: "0.75rem", color: "var(--color-muted)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <Landmark size={12} /> {c.nome}
            </span>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "4px 0 0 0", color: c.saldoAtual >= 0 ? "var(--color-cream)" : "var(--color-danger)" }}>
              {brl(c.saldoAtual)}
            </h2>
            {c.saldoReal && <span style={{ fontSize: "0.65rem", color: "var(--color-success)" }}>● Saldo real (Sicoob)</span>}
          </div>
        ))}
        {contas.length === 0 && (
          <div className="card" style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>
            Nenhuma conta bancária cadastrada ainda — cadastre em Cadastros → Contas Bancárias.
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }}>
        <div className="card">
          <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <ArrowUpRight size={18} color="var(--color-gold)" /> Fluxo de Caixa por Mês
          </h3>
          {fluxoMensal.length === 0 ? (
            <p style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>Nenhuma baixa registrada ainda.</p>
          ) : (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={fluxoMensal} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d1f20" vertical={false} />
                  <XAxis dataKey="name" stroke="#7a6060" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#7a6060" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `R$${v}`} />
                  <Tooltip contentStyle={{ background: "rgba(22,15,16,0.9)", border: "1px solid var(--color-border)", borderRadius: "8px" }} formatter={(v: any) => brl(Number(v))} />
                  <Legend />
                  <Bar dataKey="Entradas" fill="#2ecc71" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Saídas" fill="#e74c3c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Calendar size={18} color="var(--color-gold)" /> Próximos Vencimentos
          </h3>
          {proximosVencimentos.length === 0 ? (
            <p style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>Nenhum vencimento em aberto.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {proximosVencimentos.map(a => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", borderBottom: "1px solid var(--color-border)", paddingBottom: "0.5rem" }}>
                  <div>
                    {a.tipo === "pagar" ? <ArrowDownRight size={12} color="var(--color-danger)" style={{ display: "inline", marginRight: 4 }} /> : <ArrowUpRight size={12} color="var(--color-success)" style={{ display: "inline", marginRight: 4 }} />}
                    <span style={{ color: "var(--color-cream-dim)" }}>{a.descricao}</span>
                    <div style={{ color: "var(--color-muted)", fontSize: "0.7rem" }}>{fmtData(a.dataVencimento)}</div>
                  </div>
                  <strong style={{ color: a.tipo === "pagar" ? "var(--color-danger)" : "var(--color-success)" }}>
                    {brl(a.valor - a.valorPago)}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
