"use client";

import { useState, useEffect } from "react";
import {
  Landmark, ArrowUpRight, Shield, BarChart3, List, FolderKanban, SlidersHorizontal,
} from "lucide-react";

// DRE imports
import type { DreLinhaImportada } from "@/lib/dre-data";
import DRETable from "./components/DRETable";
import IndicadoresBar from "./components/IndicadoresBar";
import ConciliacaoPanel from "./components/ConciliacaoPanel";
import ConfigPanel from "./components/ConfigPanel";
import FluxoCaixaPanel from "./components/FluxoCaixaPanel";
import AgendamentosTable from "./components/AgendamentosTable";
import CadastrosPanel from "./components/CadastrosPanel";
import RelatorioFinanceiroPanel from "./components/RelatorioFinanceiroPanel";

// ── Types ──────────────────────────────────────────────────────────────────
type Tab = "fluxo" | "dre" | "lancamentos" | "relatorio" | "cadastros" | "conciliacao" | "configuracao";

export default function FinanceiroPage() {
  const [activeTab, setActiveTab] = useState<Tab>("fluxo");
  const [anoFiltro] = useState(2026);

  // ── DRE Real (importado do Excel "Realizado") ────────────────────────────
  const [dreLinhas, setDreLinhas] = useState<DreLinhaImportada[]>([]);
  const [dreLoading, setDreLoading] = useState(true);

  // ── DRE calculado a partir do nosso próprio ledger (Contas a Pagar/Receber) ──
  // "Sistema" por padrão — decisão do usuário de parar de depender do Excel do Nibo e
  // usar o próprio sistema (alimentado pelo banco real) como única fonte de verdade.
  const [dreFonte, setDreFonte] = useState<"nibo" | "sistema">("sistema");
  const [dreLinhasSistema, setDreLinhasSistema] = useState<DreLinhaImportada[]>([]);
  const [dreSistemaLoading, setDreSistemaLoading] = useState(true);

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

  useEffect(() => {
    const loadDreSistema = async () => {
      setDreSistemaLoading(true);
      try {
        const res = await fetch(`/api/financeiro/dre-sistema?ano=${anoFiltro}`);
        if (res.ok) setDreLinhasSistema(await res.json());
      } catch (err) {
        console.error("Erro ao calcular DRE do sistema:", err);
      } finally {
        setDreSistemaLoading(false);
      }
    };
    loadDreSistema();
  }, [anoFiltro]);

  // ── Tabs Config ───────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "fluxo",        label: "Fluxo de Caixa",       icon: <ArrowUpRight size={14} /> },
    { id: "dre",          label: "DRE",                  icon: <BarChart3 size={14} />    },
    { id: "lancamentos",  label: "Contas a Pagar/Receber", icon: <List size={14} />       },
    { id: "relatorio",    label: "Relatório",            icon: <SlidersHorizontal size={14} /> },
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
      {activeTab === "fluxo" && <FluxoCaixaPanel dreLinhas={dreFonte === "nibo" ? dreLinhas : dreLinhasSistema} anoDre={anoFiltro} />}

      {/* ── TAB: DRE ─────────────────────────────────────────────────────── */}
      {activeTab === "dre" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>
                DRE — Demonstração do Resultado do Exercício
              </h2>
              <p style={{ fontSize: "0.75rem", color: "var(--color-muted)", margin: "2px 0 0 0" }}>
                {dreFonte === "nibo"
                  ? "Importado direto do \"Realizado\" do seu sistema contábil"
                  : "Calculado a partir dos lançamentos já categorizados no sistema (Sicoob + manual)"}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ display: "flex", gap: "0.25rem", background: "var(--color-surface-2)", borderRadius: "0.5rem", padding: "0.2rem" }}>
                <button onClick={() => setDreFonte("nibo")} className={dreFonte === "nibo" ? "btn btn-gold btn-sm" : "btn btn-ghost btn-sm"}>Nibo (Excel)</button>
                <button onClick={() => setDreFonte("sistema")} className={dreFonte === "sistema" ? "btn btn-gold btn-sm" : "btn btn-ghost btn-sm"}>Sistema</button>
              </div>
              <span style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>Exercício:</span>
              <span className="badge badge-gold" style={{ fontSize: "0.875rem", padding: "0.375rem 0.75rem" }}>
                {anoFiltro}
              </span>
            </div>
          </div>

          {(dreFonte === "nibo" ? dreLoading : dreSistemaLoading) ? (
            <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--color-muted)" }}>
              Carregando DRE...
            </div>
          ) : (
            <>
              <DRETable linhas={dreFonte === "nibo" ? dreLinhas : dreLinhasSistema} ano={anoFiltro} />
              <IndicadoresBar linhas={dreFonte === "nibo" ? dreLinhas : dreLinhasSistema} />
            </>
          )}
        </>
      )}

      {/* ── TAB: CONTAS A PAGAR/RECEBER ──────────────────────────────────── */}
      {activeTab === "lancamentos" && <AgendamentosTable />}

      {/* ── TAB: RELATÓRIO ────────────────────────────────────────────────── */}
      {activeTab === "relatorio" && <RelatorioFinanceiroPanel />}

      {/* ── TAB: CADASTROS ───────────────────────────────────────────────── */}
      {activeTab === "cadastros" && <CadastrosPanel />}

      {/* ── TAB: CONCILIAÇÃO BANCÁRIA ───────────────────────────────────────── */}
      {activeTab === "conciliacao" && <ConciliacaoPanel />}

      {/* ── TAB: CONFIGURAÇÃO ───────────────────────────────────────── */}
      {activeTab === "configuracao" && (
        <ConfigPanel linhas={dreLinhas} ano={anoFiltro} />
      )}
    </div>
  );
}
