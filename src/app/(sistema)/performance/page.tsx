"use client";

import { useState, useEffect } from "react";
import { TrendingUp, Users, FileUp, BarChart3, Loader2 } from "lucide-react";
import DashboardBI from "./components/DashboardBI";
import ProfissionalStats from "./components/ProfissionalStats";
import ImportacaoDados from "./components/ImportacaoDados";
import ConfigHorarios, { ConfigHorariosType } from "./components/ConfigHorarios";
import ConfigMetas, { ConfigMetasType } from "./components/ConfigMetas";
import { DesempenhoProfissional, taxasOcupacaoImportadas, TaxaOcupacaoImportada } from "@/lib/performance-data";
import { Clock, Target } from "lucide-react";

type Tab = "bi" | "profissionais" | "importacao" | "config-metas";

export default function PerformancePage() {
  const [activeTab, setActiveTab] = useState<Tab>("bi");
  const [globalSelectedProf, setGlobalSelectedProf] = useState<string>("");
  const [data, setData] = useState<DesempenhoProfissional[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Contador incrementado a cada importação de taxa de ocupação — força re-render do ProfissionalStats
  const [ocupacaoVersion, setOcupacaoVersion] = useState<number>(0);
  const [metas, setMetas] = useState<ConfigMetasType>({
    "Bruna": { metaServicos: 10000, metaProdutos: 2000, metaTicket: 80, bonusServicos: 200, bonusProdutos: 100, bonusTicket: 100 },
    "Wallacy": { metaServicos: 10000, metaProdutos: 2000, metaTicket: 80, bonusServicos: 200, bonusProdutos: 100, bonusTicket: 100 },
    "Henrique": { metaServicos: 10000, metaProdutos: 2000, metaTicket: 80, bonusServicos: 200, bonusProdutos: 100, bonusTicket: 100 },
    "Vanessa": { metaServicos: 10000, metaProdutos: 2000, metaTicket: 80, bonusServicos: 200, bonusProdutos: 100, bonusTicket: 100 },
    "Tiago": { metaServicos: 10000, metaProdutos: 2000, metaTicket: 80, bonusServicos: 200, bonusProdutos: 100, bonusTicket: 100 },
  });

  // Carrega dados do Supabase ao inicializar
  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      try {
        // 1. Carrega comissões
        const resComissoes = await fetch("/api/performance/comissoes");
        if (resComissoes.ok) {
          const comissoes: DesempenhoProfissional[] = await resComissoes.json();
          setData(comissoes.filter(d =>
            d.profissional &&
            !d.profissional.toLowerCase().includes("total") &&
            !d.profissional.toLowerCase().includes("comissã") &&
            !d.profissional.toLowerCase().includes("comissao")
          ));
        }

        // 2. Carrega taxas de ocupação e popula o array in-memory que os componentes leem
        const resOcupacao = await fetch("/api/performance/ocupacao");
        if (resOcupacao.ok) {
          const taxas: TaxaOcupacaoImportada[] = await resOcupacao.json();
          // Limpa e repopula o array compartilhado
          taxasOcupacaoImportadas.splice(0, taxasOcupacaoImportadas.length, ...taxas);
          setOcupacaoVersion(v => v + 1);
        }
      } catch (err) {
        console.error("Erro ao carregar dados do banco:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadAll();
  }, []);

  const handleDataImport = (newData: DesempenhoProfissional[]) => {
    setData(prev => {
      const filtered = newData.filter(d => d.profissional && !d.profissional.toLowerCase().includes("total") && !d.profissional.toLowerCase().includes("comissã") && !d.profissional.toLowerCase().includes("comissao"));
      const merged = [...prev, ...filtered];
      const unique = Array.from(new Map(merged.map(item => [item.id, item])).values());
      return unique;
    });
  };

  const handleOcupacaoImport = async () => {
    // Recarrega taxas do banco após nova importação
    try {
      const res = await fetch("/api/performance/ocupacao");
      if (res.ok) {
        const taxas: TaxaOcupacaoImportada[] = await res.json();
        taxasOcupacaoImportadas.splice(0, taxasOcupacaoImportadas.length, ...taxas);
      }
    } catch (err) {
      console.error("Erro ao recarregar taxas:", err);
    }
    setOcupacaoVersion(v => v + 1);
  };

  const tabs = [
    { id: "bi" as Tab, label: "Dashboard Geral", icon: <BarChart3 size={16} /> },
    { id: "profissionais" as Tab, label: "Por Profissional", icon: <Users size={16} /> },
    { id: "importacao" as Tab, label: "Importar Base (Excel)", icon: <FileUp size={16} /> },
    { id: "config-metas" as Tab, label: "Metas & Bônus", icon: <Target size={16} /> },
  ];

  return (
    <div className="page-container animate-fadeIn">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title text-glow-gold" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <TrendingUp size={28} /> Performance e Produtividade
          </h1>
          <p className="page-subtitle">Análise de comissões, serviços mais vendidos e performance da equipe</p>
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

      {/* Content */}
      <div style={{ paddingBottom: "2rem" }}>
        {activeTab === "bi" && <DashboardBI data={data} metas={metas} />}
        {activeTab === "profissionais" && <ProfissionalStats data={data} metas={metas} initialSelectedProf={globalSelectedProf} onProfChange={setGlobalSelectedProf} ocupacaoVersion={ocupacaoVersion} />}
        {activeTab === "importacao" && <ImportacaoDados data={data} onImport={handleDataImport} selectedProf={globalSelectedProf} onProfChange={setGlobalSelectedProf} onNavigateToProf={() => setActiveTab("profissionais")} onOcupacaoImport={handleOcupacaoImport} />}
        {activeTab === "config-metas" && <ConfigMetas data={data} metas={metas} setMetas={setMetas} />}
      </div>
    </div>
  );
}
