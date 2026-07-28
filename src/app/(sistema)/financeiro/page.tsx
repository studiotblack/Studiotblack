"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Plus, X, Upload, Check, Landmark, ArrowUpRight, ArrowDownRight,
  Shield, RefreshCw, BarChart3, FileText, List, Search, Trash2,
} from "lucide-react";
import { movimentosFinanceiros } from "@/lib/mock-data";

// DRE imports
import { dreLancamentosIniciais, SUBCATEGORIAS, GRUPO_LABELS, MESES_ABREV, MESES_FULL } from "@/lib/dre-data";
import type { DRELancamento, DREGrupo } from "@/lib/dre-data";
import DRETable       from "./components/DRETable";
import LancamentosPanel from "./components/LancamentosPanel";
import IndicadoresBar from "./components/IndicadoresBar";
import LancamentosForm from "./components/LancamentosForm";
import ConciliacaoPanel from "./components/ConciliacaoPanel";
import ConfigPanel from "./components/ConfigPanel";

// ── Types ──────────────────────────────────────────────────────────────────
type Tab = "fluxo" | "dre" | "lancamentos" | "conciliacao" | "configuracao";

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function FinanceiroPage() {
  // ── Tab state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>("fluxo");

  // ── Fluxo de Caixa ────────────────────────────────────────────────────────
  const [movimentos, setMovimentos] = useState(movimentosFinanceiros);
  const [showAddFluxoModal, setShowAddFluxoModal] = useState(false);
  const [tipo, setTipo] = useState("ENTRADA");
  const [descricaoFluxo, setDescricaoFluxo] = useState("");
  const [categoria, setCategoria] = useState("Serviço");
  const [valorFluxo, setValorFluxo] = useState(50);
  const [pagamento, setPagamento] = useState("PIX");
  const [dataFluxo, setDataFluxo] = useState("2026-05-20");

  const totalEntradas = movimentos.filter(m => m.tipo === "ENTRADA").reduce((a, c) => a + c.valor, 0);
  const totalSaidas   = movimentos.filter(m => m.tipo === "SAIDA").reduce((a, c) => a + c.valor, 0);
  const saldoLiquido  = totalEntradas - totalSaidas;

  const handleAddMovimento = (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricaoFluxo) return;
    setMovimentos([{ id: `f-${Date.now()}`, tipo, categoria, descricao: descricaoFluxo, valor: Number(valorFluxo), data: dataFluxo, pagamento }, ...movimentos]);
    setShowAddFluxoModal(false);
    setDescricaoFluxo("");
    setValorFluxo(50);
  };

  // ── DRE State ─────────────────────────────────────────────────────────────
  const [dreLancamentos, setDreLancamentos] = useState<DRELancamento[]>(dreLancamentosIniciais);
  const [anoFiltro] = useState(2026);

  // Panel state (drawer lateral)
  const [panelGrupo, setPanelGrupo]     = useState<DREGrupo | null>(null);
  const [panelSub, setPanelSub]         = useState<string | null>(null);
  const [panelMes, setPanelMes]         = useState<number | null>(null);

  // Form state
  const [showForm, setShowForm]         = useState(false);
  const [formPrefillGrupo, setFormPrefillGrupo] = useState<DREGrupo | undefined>();
  const [formPrefillSub, setFormPrefillSub]     = useState<string | undefined>();
  const [formPrefillMes, setFormPrefillMes]     = useState<number | undefined>();

  const handleCellClick = useCallback((grupo: DREGrupo, sub: string, mes: number) => {
    setPanelGrupo(grupo);
    setPanelSub(sub);
    setPanelMes(mes);
  }, []);

  const handlePanelClose = useCallback(() => {
    setPanelGrupo(null);
    setPanelSub(null);
    setPanelMes(null);
  }, []);

  const handleOpenFormFromPanel = useCallback(() => {
    setFormPrefillGrupo(panelGrupo ?? undefined);
    setFormPrefillSub(panelSub ?? undefined);
    setFormPrefillMes(panelMes ?? undefined);
    handlePanelClose();
    setShowForm(true);
  }, [panelGrupo, panelSub, panelMes, handlePanelClose]);

  const handleSaveLancamento = useCallback((l: DRELancamento) => {
    setDreLancamentos(prev => [...prev, l]);
    setShowForm(false);
  }, []);

  const handleDeleteLancamento = (id: string) => {
    setDreLancamentos(prev => prev.filter(l => l.id !== id));
  };

  // ── Lançamentos tab: filter state ─────────────────────────────────────────
  const [filterGrupo, setFilterGrupo] = useState<string>("todos");
  const [filterMes, setFilterMes]     = useState<string>("todos");
  const [filterSearch, setFilterSearch] = useState("");

  const filteredLancamentos = useMemo(() => {
    return dreLancamentos.filter(l => {
      const mes = parseInt(l.data.split("-")[1]);
      const matchGrupo  = filterGrupo === "todos" || l.grupo === filterGrupo;
      const matchMes    = filterMes === "todos" || mes === parseInt(filterMes);
      const matchSearch = !filterSearch || l.descricao.toLowerCase().includes(filterSearch.toLowerCase());
      return matchGrupo && matchMes && matchSearch;
    });
  }, [dreLancamentos, filterGrupo, filterMes, filterSearch]);

  // ── Integração Sicoob / Conciliação ─────────────────────────────────────────
  const [syncing, setSyncing] = useState(false);

  const handleSyncSicoob = async (mes: number, ano: number) => {
    setSyncing(true);
    try {
      // Aqui faríamos o fetch real para a API
      await new Promise(r => setTimeout(r, 1500));
    } finally {
      setSyncing(false);
    }
  };

  const handleConciliar = (bankTx: any, novoLancamento: Partial<DRELancamento>) => {
    const l: DRELancamento = {
      id: `conciliado-${bankTx.id}`,
      data: novoLancamento.data || bankTx.data,
      descricao: novoLancamento.descricao || bankTx.descricao,
      valor: novoLancamento.valor || bankTx.valor,
      tipo: novoLancamento.tipo || "SAIDA",
      grupo: novoLancamento.grupo || "despesa",
      subcategoria: novoLancamento.subcategoria || "Outros",
      subsubcategoria: novoLancamento.subsubcategoria,
      origem: novoLancamento.origem || "banco",
      importadoSicoob: novoLancamento.importadoSicoob || true,
    };
    setDreLancamentos(prev => [...prev, l]);
  };

  // ── Tabs Config ───────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "fluxo",       label: "Fluxo de Caixa",     icon: <ArrowUpRight size={14} />   },
    { id: "dre",         label: "DRE",                 icon: <BarChart3 size={14} />      },
    { id: "lancamentos", label: "Lançamentos",         icon: <List size={14} />           },
    { id: "conciliacao", label: "Conciliação Bancária", icon: <Landmark size={14} />      },
    { id: "configuracao",label: "Configuração DRE",    icon: <Shield size={14} />         },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page-container animate-fadeIn">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title text-glow-gold">Gestão Financeira</h1>
          <p className="page-subtitle">Fluxo de caixa, DRE interativo e integração bancária Sicoob</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {activeTab === "fluxo" && (
            <button className="btn btn-gold" onClick={() => setShowAddFluxoModal(true)}>
              <Plus size={16} /> <span>Lançamento</span>
            </button>
          )}
          {(activeTab === "dre" || activeTab === "lancamentos") && (
            <button className="btn btn-gold" onClick={() => { setFormPrefillGrupo(undefined); setFormPrefillSub(undefined); setFormPrefillMes(undefined); setShowForm(true); }}>
              <Plus size={16} /> <span>Novo Lançamento DRE</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.25rem", borderBottom: "1px solid var(--color-border)", marginBottom: "1.5rem", overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: "0.75rem 1rem", background: "none", border: "none", whiteSpace: "nowrap",
            color: activeTab === t.id ? "var(--color-gold)" : "var(--color-muted)",
            borderBottom: activeTab === t.id ? "2px solid var(--color-gold)" : "2px solid transparent",
            fontWeight: activeTab === t.id ? 600 : 400, cursor: "pointer",
            fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.375rem",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: FLUXO DE CAIXA ───────────────────────────────────────────── */}
      {activeTab === "fluxo" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem", marginBottom: "1.5rem" }}>
            <div className="kpi-card">
              <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Total de Entradas</span>
              <h2 style={{ fontSize: "1.75rem", fontWeight: 700, margin: "4px 0 0 0", color: "var(--color-success)" }}>
                + {fmtBRL(totalEntradas)}
              </h2>
            </div>
            <div className="kpi-card">
              <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Total de Saídas</span>
              <h2 style={{ fontSize: "1.75rem", fontWeight: 700, margin: "4px 0 0 0", color: "var(--color-danger)" }}>
                - {fmtBRL(totalSaidas)}
              </h2>
            </div>
            <div className="kpi-card">
              <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Resultado Período</span>
              <h2 style={{ fontSize: "1.75rem", fontWeight: 700, margin: "4px 0 0 0", color: saldoLiquido >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
                {fmtBRL(saldoLiquido)}
              </h2>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Descrição</th><th>Categoria</th><th>Data</th>
                  <th>Método</th><th style={{ textAlign: "right" }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {movimentos.map(mov => (
                  <tr key={mov.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {mov.tipo === "ENTRADA"
                          ? <ArrowUpRight size={16} className="value-positive" />
                          : <ArrowDownRight size={16} className="value-negative" />}
                        <span style={{ fontWeight: 500, color: "var(--color-cream)" }}>{mov.descricao}</span>
                      </div>
                    </td>
                    <td><span className="badge badge-gold">{mov.categoria}</span></td>
                    <td style={{ fontSize: "0.8125rem" }}>{new Date(mov.data).toLocaleDateString("pt-BR")}</td>
                    <td><span className="badge badge-muted" style={{ fontSize: "0.65rem" }}>{mov.pagamento}</span></td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: mov.tipo === "ENTRADA" ? "var(--color-success)" : "var(--color-danger)" }}>
                      {mov.tipo === "ENTRADA" ? "+" : "-"} R$ {mov.valor.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── TAB: DRE ─────────────────────────────────────────────────────── */}
      {activeTab === "dre" && (
        <>
          {/* Year selector */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>
                DRE — Demonstração do Resultado do Exercício
              </h2>
              <p style={{ fontSize: "0.75rem", color: "var(--color-muted)", margin: "2px 0 0 0" }}>
                Clique em qualquer valor para ver os lançamentos detalhados
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>Exercício:</span>
              <span className="badge badge-gold" style={{ fontSize: "0.875rem", padding: "0.375rem 0.75rem" }}>
                {anoFiltro}
              </span>
            </div>
          </div>

          <DRETable
            lancamentos={dreLancamentos}
            anoFiltro={anoFiltro}
            onCellClick={handleCellClick}
          />

          <IndicadoresBar lancamentos={dreLancamentos} />

          <LancamentosPanel
            lancamentos={dreLancamentos}
            grupo={panelGrupo}
            subcategoria={panelSub}
            mes={panelMes}
            onClose={handlePanelClose}
            onAddClick={handleOpenFormFromPanel}
          />
        </>
      )}

      {/* ── TAB: LANÇAMENTOS ─────────────────────────────────────────────── */}
      {activeTab === "lancamentos" && (
        <>
          {/* Filters */}
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <Search size={14} color="var(--color-muted)"
                style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input
                type="search" placeholder="Buscar lançamento..."
                value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
                style={{ paddingLeft: "2.25rem", width: "100%" }}
              />
            </div>
            <select value={filterGrupo} onChange={e => setFilterGrupo(e.target.value)} style={{ width: "auto" }}>
              <option value="todos">Todos os grupos</option>
              <option value="receita">Receita</option>
              <option value="custo">Custo Operacional</option>
              <option value="despesa">Despesa Operacional</option>
              <option value="investimento">Investimentos</option>
              <option value="financiamento">Financiamento</option>
            </select>
            <select value={filterMes} onChange={e => setFilterMes(e.target.value)} style={{ width: "auto" }}>
              <option value="todos">Todos os meses</option>
              {MESES_ABREV.map((m, i) => <option key={i} value={String(i+1)}>{m}</option>)}
            </select>
          </div>

          {/* Summary */}
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>
              {filteredLancamentos.length} lançamento{filteredLancamentos.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Table */}
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th><th>Descrição</th><th>Grupo</th>
                  <th>Subcategoria</th><th>Origem</th>
                  <th style={{ textAlign: "right" }}>Valor</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filteredLancamentos.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "3rem", color: "var(--color-muted)" }}>
                      Nenhum lançamento encontrado.
                    </td>
                  </tr>
                ) : filteredLancamentos.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                      {new Date(l.data + "T12:00:00").toLocaleDateString("pt-BR")}
                    </td>
                    <td style={{ fontWeight: 500, color: "var(--color-cream)" }}>{l.descricao}</td>
                    <td>
                      <span className="badge" style={{ fontSize: "0.65rem", background: "rgba(212,175,140,0.1)", color: "var(--color-gold)", border: "1px solid var(--color-gold-dark)" }}>
                        {GRUPO_LABELS[l.grupo].replace("(-) ", "").replace("= ", "")}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.8125rem", color: "var(--color-cream-dim)" }}>{l.subcategoria}</td>
                    <td>
                      <span className="badge" style={{
                        fontSize: "0.65rem",
                        background: l.origem === "banco" ? "rgba(52,152,219,0.12)" : "rgba(46,204,113,0.1)",
                        color: l.origem === "banco" ? "var(--color-info)" : "var(--color-success)",
                        border: `1px solid ${l.origem === "banco" ? "var(--color-info)" : "var(--color-success)"}40`,
                      }}>
                        {l.origem === "banco" ? "Banco" : "Caixa"}
                        {l.importadoSicoob ? " • Sicoob" : ""}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: l.tipo === "ENTRADA" ? "var(--color-success)" : "var(--color-danger)" }}>
                      {l.tipo === "ENTRADA" ? "+" : "-"} {fmtBRL(l.valor)}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        onClick={() => handleDeleteLancamento(l.id)}
                        style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer", padding: "0.25rem" }}
                        title="Excluir lançamento"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── TAB: CONCILIAÇÃO BANCÁRIA ───────────────────────────────────────── */}
      {activeTab === "conciliacao" && (
        <ConciliacaoPanel 
          onSync={handleSyncSicoob} 
          isSyncing={syncing} 
          lancamentos={dreLancamentos} 
          onConciliar={handleConciliar} 
        />
      )}

      {/* ── TAB: CONFIGURAÇÃO ───────────────────────────────────────── */}
      {activeTab === "configuracao" && (
        <ConfigPanel />
      )}

      {/* ── MODAL: Fluxo de Caixa ─────────────────────────────────────────── */}
      {showAddFluxoModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 500 }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>Lançamento Financeiro</h2>
              <button onClick={() => setShowAddFluxoModal(false)} style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddMovimento} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div>
                <label className="form-label">Tipo de Lançamento</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  {["ENTRADA","SAIDA"].map(t => (
                    <button key={t} type="button" className="btn" onClick={() => setTipo(t)} style={{
                      background: tipo === t ? (t === "ENTRADA" ? "var(--color-success-dim)" : "var(--color-danger-dim)") : "var(--color-surface-3)",
                      color: tipo === t ? (t === "ENTRADA" ? "var(--color-success)" : "var(--color-danger)") : "var(--color-muted)",
                      border: `1px solid ${tipo === t ? (t === "ENTRADA" ? "var(--color-success)" : "var(--color-danger)") : "var(--color-border)"}`,
                    }}>
                      {t === "ENTRADA" ? "Entrada / Receita" : "Saída / Despesa"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="form-label">Descrição</label>
                <input type="text" placeholder="Ex: Compra de toalhas" value={descricaoFluxo} onChange={e => setDescricaoFluxo(e.target.value)} required />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label className="form-label">Categoria</label>
                  <select value={categoria} onChange={e => setCategoria(e.target.value)}>
                    <option value="Serviço">Serviço</option>
                    <option value="Produto">Produto</option>
                    <option value="Compra">Compra</option>
                    <option value="Aluguel">Aluguel</option>
                    <option value="Salário">Salário</option>
                    <option value="Material">Material</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Valor (R$)</label>
                  <input type="number" value={valorFluxo} onChange={e => setValorFluxo(Number(e.target.value))} min={0.01} step={0.01} required />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label className="form-label">Pagamento</label>
                  <select value={pagamento} onChange={e => setPagamento(e.target.value)}>
                    <option>PIX</option><option>DINHEIRO</option>
                    <option>CARTAO_CREDITO</option><option>CARTAO_DEBITO</option>
                    <option>TRANSFERENCIA</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Data</label>
                  <input type="date" value={dataFluxo} onChange={e => setDataFluxo(e.target.value)} required />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddFluxoModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-gold">Confirmar Lançamento</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: DRE Lançamento Form ───────────────────────────────────── */}
      <LancamentosForm
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSave={handleSaveLancamento}
        prefillGrupo={formPrefillGrupo}
        prefillSub={formPrefillSub}
        prefillMes={formPrefillMes}
      />
    </div>
  );
}
