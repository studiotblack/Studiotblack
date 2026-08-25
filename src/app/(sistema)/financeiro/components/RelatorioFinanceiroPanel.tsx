"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Download, X } from "lucide-react";
import type {
  Agendamento, TipoAgendamento, StatusAgendamento,
  ContaBancaria, Contato, CategoriaFinanceira, CentroCusto,
} from "@/lib/financeiro-data";
import { statusAgendamento, STATUS_LABELS, STATUS_COLORS } from "@/lib/financeiro-data";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d: string | null | undefined) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";

type TipoFiltro = TipoAgendamento | "todos";

export default function RelatorioFinanceiroPanel() {
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>([]);
  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [tipo, setTipo] = useState<TipoFiltro>("todos");
  const [categoriaId, setCategoriaId] = useState("");
  const [centroCustoId, setCentroCustoId] = useState("");
  const [contaBancariaId, setContaBancariaId] = useState("");
  const [contatoId, setContatoId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<StatusAgendamento | "todos">("todos");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    (async () => {
      const [rContas, rContatos, rCategorias, rCentros] = await Promise.all([
        fetch("/api/financeiro/contas-bancarias"),
        fetch("/api/financeiro/contatos"),
        fetch("/api/financeiro/categorias"),
        fetch("/api/financeiro/centros-custo"),
      ]);
      setContas(rContas.ok ? await rContas.json() : []);
      setContatos(rContatos.ok ? await rContatos.json() : []);
      setCategorias(rCategorias.ok ? await rCategorias.json() : []);
      setCentros(rCentros.ok ? await rCentros.json() : []);
    })();
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tipo !== "todos") params.set("tipo", tipo);
      if (categoriaId) params.set("categoriaId", categoriaId);
      if (centroCustoId) params.set("centroCustoId", centroCustoId);
      if (contaBancariaId) params.set("contaBancariaId", contaBancariaId);
      if (contatoId) params.set("contatoId", contatoId);
      if (dataInicio) params.set("dataInicio", dataInicio);
      if (dataFim) params.set("dataFim", dataFim);
      const res = await fetch(`/api/financeiro/agendamentos?${params.toString()}`);
      setAgendamentos(res.ok ? await res.json() : []);
    } catch (err) {
      console.error("Erro ao carregar relatório:", err);
    } finally {
      setLoading(false);
    }
  }, [tipo, categoriaId, centroCustoId, contaBancariaId, contatoId, dataInicio, dataFim]);

  useEffect(() => { carregar(); }, [carregar]);

  const filtrados = useMemo(() => {
    return agendamentos
      .map(a => ({ ...a, status: statusAgendamento(a) }))
      .filter(a => statusFiltro === "todos" || a.status === statusFiltro)
      .filter(a => !busca || a.descricao.toLowerCase().includes(busca.toLowerCase()) || a.contatoNome?.toLowerCase().includes(busca.toLowerCase()));
  }, [agendamentos, statusFiltro, busca]);

  const totalValor = filtrados.reduce((acc, a) => acc + a.valor, 0);
  const totalPago = filtrados.reduce((acc, a) => acc + a.valorPago, 0);

  const limparFiltros = () => {
    setTipo("todos"); setCategoriaId(""); setCentroCustoId(""); setContaBancariaId("");
    setContatoId(""); setDataInicio(""); setDataFim(""); setStatusFiltro("todos"); setBusca("");
  };

  const exportarCSV = () => {
    const linhas = [
      ["Vencimento", "Tipo", "Contato", "Descrição", "Categoria", "Centro de Custo", "Conta Bancária", "Status", "Valor", "Pago"],
      ...filtrados.map(a => [
        fmtData(a.dataVencimento), a.tipo === "pagar" ? "Pagar" : "Receber", a.contatoNome || "",
        a.descricao, a.categoriaNome || "", a.centroCustoNome || "", a.contaBancariaNome || "",
        STATUS_LABELS[a.status], a.valor.toFixed(2).replace(".", ","), a.valorPago.toFixed(2).replace(".", ","),
      ]),
    ];
    const csv = linhas.map(l => l.map(c => `"${c}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-financeiro-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtroAtivo = tipo !== "todos" || categoriaId || centroCustoId || contaBancariaId || contatoId || dataInicio || dataFim || statusFiltro !== "todos" || busca;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Relatório Financeiro</h2>
        <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", margin: "2px 0 0 0" }}>
          Filtre contas a pagar/receber por período, categoria, centro de custo, conta bancária ou contato.
        </p>
      </div>

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem" }}>
          <div>
            <label className="form-label">Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as TipoFiltro)}>
              <option value="todos">Pagar e Receber</option>
              <option value="pagar">Contas a Pagar</option>
              <option value="receber">Contas a Receber</option>
            </select>
          </div>
          <div>
            <label className="form-label">De</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Até</label>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Status</label>
            <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value as StatusAgendamento | "todos")}>
              <option value="todos">Todos os status</option>
              <option value="aberto">Em aberto</option>
              <option value="parcial">Parcialmente pago</option>
              <option value="vencido">Vencido</option>
              <option value="pago">Quitado</option>
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem" }}>
          <div>
            <label className="form-label">Categoria</label>
            <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)}>
              <option value="">Todas</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Centro de Custo</label>
            <select value={centroCustoId} onChange={e => setCentroCustoId(e.target.value)}>
              <option value="">Todos</option>
              {centros.filter(c => c.ativo).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Conta Bancária</label>
            <select value={contaBancariaId} onChange={e => setContaBancariaId(e.target.value)}>
              <option value="">Todas</option>
              {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Contato</label>
            <select value={contatoId} onChange={e => setContatoId(e.target.value)}>
              <option value="">Todos</option>
              {contatos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Search size={14} color="var(--color-muted)" style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)" }} />
            <input placeholder="Buscar descrição ou contato..." value={busca} onChange={e => setBusca(e.target.value)} style={{ paddingLeft: "2.25rem" }} />
          </div>
          {filtroAtivo && (
            <button className="btn btn-ghost btn-sm" onClick={limparFiltros}><X size={13} /> Limpar filtros</button>
          )}
          <button className="btn btn-gold btn-sm" onClick={exportarCSV} disabled={filtrados.length === 0}>
            <Download size={13} /> Exportar CSV
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
        <div className="kpi-card">
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Registros</span>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "4px 0 0 0" }}>{filtrados.length}</h2>
        </div>
        <div className="kpi-card">
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Valor Total</span>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "4px 0 0 0", color: "var(--color-gold)" }}>{brl(totalValor)}</h2>
        </div>
        <div className="kpi-card">
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Total Pago/Recebido</span>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "4px 0 0 0", color: "var(--color-success)" }}>{brl(totalPago)}</h2>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Vencimento</th><th>Tipo</th><th>Contato</th><th>Descrição</th>
              <th>Categoria</th><th>Centro de Custo</th><th>Conta</th><th>Status</th>
              <th style={{ textAlign: "right" }}>Valor</th><th style={{ textAlign: "right" }}>Pago</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ textAlign: "center", padding: "2rem", color: "var(--color-muted)" }}>Carregando...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: "center", padding: "3rem", color: "var(--color-muted)" }}>Nenhum lançamento encontrado com esses filtros.</td></tr>
            ) : filtrados.map(a => (
              <tr key={a.id}>
                <td style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>{fmtData(a.dataVencimento)}</td>
                <td>
                  <span className="badge" style={{ fontSize: "0.65rem", background: a.tipo === "pagar" ? "rgba(231,76,60,0.12)" : "rgba(46,204,113,0.12)", color: a.tipo === "pagar" ? "var(--color-danger)" : "var(--color-success)" }}>
                    {a.tipo === "pagar" ? "Pagar" : "Receber"}
                  </span>
                </td>
                <td style={{ fontWeight: 500 }}>{a.contatoNome}</td>
                <td style={{ fontSize: "0.85rem", color: "var(--color-cream-dim)" }}>{a.descricao}</td>
                <td style={{ fontSize: "0.78rem", color: "var(--color-muted)" }}>{a.categoriaNome || "—"}</td>
                <td style={{ fontSize: "0.78rem", color: "var(--color-muted)" }}>{a.centroCustoNome || "—"}</td>
                <td style={{ fontSize: "0.78rem", color: "var(--color-muted)" }}>{a.contaBancariaNome || "—"}</td>
                <td>
                  <span className="badge" style={{ background: `${STATUS_COLORS[a.status]}22`, color: STATUS_COLORS[a.status], border: `1px solid ${STATUS_COLORS[a.status]}55`, fontSize: "0.65rem" }}>
                    {STATUS_LABELS[a.status]}
                  </span>
                </td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{brl(a.valor)}</td>
                <td style={{ textAlign: "right", color: "var(--color-muted)" }}>{brl(a.valorPago)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
