"use client";

import { useState, useEffect } from "react";
import {
  Landmark, ArrowUpRight, Shield, BarChart3, List, FolderKanban,
} from "lucide-react";

// DRE imports
import { dreLancamentosIniciais } from "@/lib/dre-data";
import type { DRELancamento, DreLinhaImportada } from "@/lib/dre-data";
import DRETable from "./components/DRETable";
import IndicadoresBar from "./components/IndicadoresBar";
import ConciliacaoPanel from "./components/ConciliacaoPanel";
import ConfigPanel from "./components/ConfigPanel";
import FluxoCaixaPanel from "./components/FluxoCaixaPanel";
import AgendamentosTable from "./components/AgendamentosTable";
import CadastrosPanel from "./components/CadastrosPanel";

// ── Types ──────────────────────────────────────────────────────────────────
type Tab = "fluxo" | "dre" | "lancamentos" | "cadastros" | "conciliacao" | "configuracao";

export default function FinanceiroPage() {
  const [activeTab, setActiveTab] = useState<Tab>("fluxo");

  // ── DRE (lançamentos antigos, usados só pela Conciliação nesta entrega) ────
  const [dreLancamentos, setDreLancamentos] = useState<DRELancamento[]>(dreLancamentosIniciais);
  const [anoFiltro] = useState(2026);

  // ── DRE Real (importado do Excel "Realizado") ────────────────────────────
  const [dreLinhas, setDreLinhas] = useState<DreLinhaImportada[]>([]);
  const [dreLoading, setDreLoading] = useState(true);

  useEffect(() => {
    const loadDre = async () => {
      setDreLoading(true);
      try {
        const res = await fetch(`/api/financeiro/dre?ano=${anoFiltro}`);
        if (res.ok) {
          const rows = await res.json();
          setDreLinhas(rows.map((r: any, i: number) => ({ ...r, ordem: r.ordem ?? i })));
        }
      } catch (err) {
        console.error("Erro ao carregar DRE:", err);
      } finally {
        setDreLoading(false);
      }
    };
    loadDre();
  }, [anoFiltro]);

  // ── Integração Sicoob / Conciliação (inalterado nesta entrega) ───────────
  const [syncing, setSyncing] = useState(false);

  const handleSyncSicoob = async (mes: number, ano: number) => {
    setSyncing(true);
    try {
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
    { id: "fluxo",        label: "Fluxo de Caixa",       icon: <ArrowUpRight size={14} /> },
    { id: "dre",          label: "DRE",                  icon: <BarChart3 size={14} />    },
    { id: "lancamentos",  label: "Contas a Pagar/Receber", icon: <List size={14} />       },
    { id: "cadastros",    label: "Cadastros",            icon: <FolderKanban size={14} /> },
    { id: "conciliacao",  label: "Conciliação Bancária", icon: <Landmark size={14} />     },
    { id: "configuracao", label: "Configuração DRE",     icon: <Shield size={14} />       },
  ];

  return (
    <div className="page-container animate-fadeIn">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title text-glow-gold">Gestão Financeira</h1>
          <p className="page-subtitle">Fluxo de caixa, contas a pagar/receber, DRE e integração bancária Sicoob</p>
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
      {activeTab === "fluxo" && <FluxoCaixaPanel dreLinhas={dreLinhas} anoDre={anoFiltro} />}

      {/* ── TAB: DRE ─────────────────────────────────────────────────────── */}
      {activeTab === "dre" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>
                DRE — Demonstração do Resultado do Exercício
              </h2>
              <p style={{ fontSize: "0.75rem", color: "var(--color-muted)", margin: "2px 0 0 0" }}>
                Importado direto do &quot;Realizado&quot; do seu sistema contábil
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>Exercício:</span>
              <span className="badge badge-gold" style={{ fontSize: "0.875rem", padding: "0.375rem 0.75rem" }}>
                {anoFiltro}
              </span>
            </div>
          </div>

          {dreLoading ? (
            <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--color-muted)" }}>
              Carregando DRE...
            </div>
          ) : (
            <>
              <DRETable linhas={dreLinhas} ano={anoFiltro} />
              <IndicadoresBar linhas={dreLinhas} />
            </>
          )}
        </>
      )}

      {/* ── TAB: CONTAS A PAGAR/RECEBER ──────────────────────────────────── */}
      {activeTab === "lancamentos" && <AgendamentosTable />}

      {/* ── TAB: CADASTROS ───────────────────────────────────────────────── */}
      {activeTab === "cadastros" && <CadastrosPanel />}

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
        <ConfigPanel linhas={dreLinhas} ano={anoFiltro} />
      )}
    </div>
  );
}
