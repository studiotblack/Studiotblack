"use client";

import { useState, useEffect, useMemo } from "react";
import { ArrowUpRight, ArrowDownRight, Landmark, Calendar } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { ContaBancaria, Agendamento } from "@/lib/financeiro-data";
import { statusAgendamento } from "@/lib/financeiro-data";

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

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR");

export default function FluxoCaixaPanel() {
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [baixas, setBaixas] = useState<BaixaComTipo[]>([]);
  const [transferencias, setTransferencias] = useState<TransferenciaRow[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregar = async () => {
      setLoading(true);
      try {
        const [rContas, rBaixas, rTransf, rPagar, rReceber] = await Promise.all([
          fetch("/api/financeiro/contas-bancarias"),
          fetch("/api/financeiro/baixas"),
          fetch("/api/financeiro/transferencias"),
          fetch("/api/financeiro/agendamentos?tipo=pagar"),
          fetch("/api/financeiro/agendamentos?tipo=receber"),
        ]);
        setContas(rContas.ok ? await rContas.json() : []);
        setBaixas(rBaixas.ok ? await rBaixas.json() : []);
        setTransferencias(rTransf.ok ? await rTransf.json() : []);
        const pagar = rPagar.ok ? await rPagar.json() : [];
        const receber = rReceber.ok ? await rReceber.json() : [];
        setAgendamentos([...pagar, ...receber]);
      } catch (err) {
        console.error("Erro ao carregar fluxo de caixa:", err);
      } finally {
        setLoading(false);
      }
    };
    carregar();
  }, []);

  const saldoPorConta = useMemo(() => {
    return contas.map(conta => {
      const entradas = baixas.filter(b => b.contaBancariaId === conta.id && b.agendamentoTipo === "receber").reduce((a, b) => a + b.valor, 0);
      const saidas = baixas.filter(b => b.contaBancariaId === conta.id && b.agendamentoTipo === "pagar").reduce((a, b) => a + b.valor, 0);
      const transfRecebidas = transferencias.filter(t => t.contaDestinoId === conta.id).reduce((a, t) => a + t.valor, 0);
      const transfEnviadas = transferencias.filter(t => t.contaOrigemId === conta.id).reduce((a, t) => a + t.valor, 0);
      const saldoAtual = conta.saldoInicial + entradas - saidas + transfRecebidas - transfEnviadas;
      return { ...conta, saldoAtual };
    });
  }, [contas, baixas, transferencias]);

  const saldoConsolidado = saldoPorConta.reduce((a, c) => a + c.saldoAtual, 0);

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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem" }}>
        <div className="kpi-card">
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Saldo Consolidado</span>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 700, margin: "4px 0 0 0", color: saldoConsolidado >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
            {brl(saldoConsolidado)}
          </h2>
        </div>
        {saldoPorConta.map(c => (
          <div key={c.id} className="kpi-card">
            <span style={{ fontSize: "0.75rem", color: "var(--color-muted)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <Landmark size={12} /> {c.nome}
            </span>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "4px 0 0 0", color: c.saldoAtual >= 0 ? "var(--color-cream)" : "var(--color-danger)" }}>
              {brl(c.saldoAtual)}
            </h2>
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
