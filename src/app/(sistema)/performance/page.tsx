"use client";

import { useState } from "react";
import { TrendingUp, Users, FileUp, BarChart3, Search } from "lucide-react";
import DashboardBI from "./components/DashboardBI";
import ProfissionalStats from "./components/ProfissionalStats";
import ImportacaoDados from "./components/ImportacaoDados";
import ConfigHorarios, { ConfigHorariosType } from "./components/ConfigHorarios";
import ConfigMetas, { ConfigMetasType } from "./components/ConfigMetas";
import { mockPdfData, DesempenhoProfissional } from "@/lib/performance-data";
import { Clock, Target } from "lucide-react";

type Tab = "bi" | "profissionais" | "importacao" | "config-metas";

export default function PerformancePage() {
  const [activeTab, setActiveTab] = useState<Tab>("bi");
  const [globalSelectedProf, setGlobalSelectedProf] = useState<string>("");
  const [data, setData] = useState<DesempenhoProfissional[]>(() => {
    return mockPdfData.filter(d => d.profissional && !d.profissional.toLowerCase().includes("total") && !d.profissional.toLowerCase().includes("comissã") && !d.profissional.toLowerCase().includes("comissao"));
  });
  // Contador incrementado a cada importação de taxa de ocupação — força re-render do ProfissionalStats
  const [ocupacaoVersion, setOcupacaoVersion] = useState<number>(0);
  const [metas, setMetas] = useState<ConfigMetasType>({
    "Bruna": { metaServicos: 10000, metaProdutos: 2000, metaTicket: 80, bonusServicos: 200, bonusProdutos: 100, bonusTicket: 100 },
    "Wallacy": { metaServicos: 10000, metaProdutos: 2000, metaTicket: 80, bonusServicos: 200, bonusProdutos: 100, bonusTicket: 100 },
    "Henrique": { metaServicos: 10000, metaProdutos: 2000, metaTicket: 80, bonusServicos: 200, bonusProdutos: 100, bonusTicket: 100 },
    "Vanessa": { metaServicos: 10000, metaProdutos: 2000, metaTicket: 80, bonusServicos: 200, bonusProdutos: 100, bonusTicket: 100 },
    "Tiago": { metaServicos: 10000, metaProdutos: 2000, metaTicket: 80, bonusServicos: 200, bonusProdutos: 100, bonusTicket: 100 },
  });

  const handleDataImport = (newData: DesempenhoProfissional[]) => {
    setData(prev => {
      const filtered = newData.filter(d => d.profissional && !d.profissional.toLowerCase().includes("total") && !d.profissional.toLowerCase().includes("comissã") && !d.profissional.toLowerCase().includes("comissao"));
      const merged = [...prev, ...filtered];
      const unique = Array.from(new Map(merged.map(item => [item.id, item])).values());
      return unique;
    });
  };

  const handleOcupacaoImport = () => {
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
