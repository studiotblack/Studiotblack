"use client";

import { useState, useEffect, useCallback } from "react";
import { Target, Save, Loader2 } from "lucide-react";
import { getProfissionaisUnicos, getContatoIdPorProfissional, DesempenhoProfissional } from "@/lib/performance-data";

export interface MetasProfissional {
  metaServicos: number;
  metaProdutos: number;
  metaTicket: number;
  bonusServicos: number;
  bonusProdutos: number;
  bonusTicket: number;
}

export type ConfigMetasType = Record<string, MetasProfissional>;

interface ConfigMetasProps {
  data: DesempenhoProfissional[];
  metas: ConfigMetasType;
  setMetas: (m: ConfigMetasType) => void;
}

const METAS_PADRAO: MetasProfissional = {
  metaServicos: 10000, metaProdutos: 2000, metaTicket: 80,
  bonusServicos: 200, bonusProdutos: 100, bonusTicket: 100,
};

const mesAtual = () => {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export default function ConfigMetas({ data, metas, setMetas }: ConfigMetasProps) {
  const profissionais = getProfissionaisUnicos(data);
  const [selectedProf, setSelectedProf] = useState<string>(profissionais[0] || "");
  const [mesAno, setMesAno] = useState<string>(mesAtual());
  const [currentMetas, setCurrentMetas] = useState<MetasProfissional>(metas[selectedProf] || METAS_PADRAO);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const contatoId = getContatoIdPorProfissional(selectedProf);

  const carregarMeta = useCallback(async () => {
    if (!contatoId) { setCurrentMetas(metas[selectedProf] || METAS_PADRAO); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/performance/metas?contatoId=${contatoId}&mesAno=${encodeURIComponent(mesAno)}`);
      const rows = res.ok ? await res.json() : [];
      const meta = rows[0];
      setCurrentMetas(meta ? {
        metaServicos: meta.metaServicos, metaProdutos: meta.metaProdutos, metaTicket: meta.metaTicket,
        bonusServicos: meta.bonusServicos, bonusProdutos: meta.bonusProdutos, bonusTicket: meta.bonusTicket,
      } : METAS_PADRAO);
    } catch {
      setCurrentMetas(METAS_PADRAO);
    } finally {
      setLoading(false);
    }
  }, [contatoId, mesAno, metas, selectedProf]);

  useEffect(() => { carregarMeta(); }, [carregarMeta]);

  if (!selectedProf) return <div style={{ color: "var(--color-muted)" }}>Nenhum profissional disponível.</div>;

  const handleChange = (field: keyof MetasProfissional, value: number) => {
    setCurrentMetas({ ...currentMetas, [field]: value });
  };

  const handleSave = async () => {
    if (!contatoId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/performance/metas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contatoId, mesAno, ...currentMetas }),
      });
      if (res.ok) {
        setMetas({ ...metas, [selectedProf]: currentMetas });
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
          <Target color="var(--color-gold)" size={24} />
          <div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Metas e Bonificações</h3>
            <p style={{ color: "var(--color-muted)", fontSize: "0.85rem", margin: 0 }}>Configure os alvos e os bônus (em R$) por colaborador e por mês.</p>
          </div>
        </div>

        <div style={{ marginBottom: "1.5rem", display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>Profissional:</label>
            <select
              value={selectedProf}
              onChange={e => setSelectedProf(e.target.value)}
              style={{ width: "260px", background: "var(--color-surface-2)", padding: "0.5rem", borderRadius: "0.5rem", border: "1px solid var(--color-border)", color: "var(--color-cream)" }}
            >
              {profissionais.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>Mês:</label>
            <input
              type="month"
              value={mesAno ? `${mesAno.split("/")[1]}-${mesAno.split("/")[0]}` : ""}
              onChange={e => {
                const [ano, mes] = e.target.value.split("-");
                setMesAno(`${mes}/${ano}`);
              }}
              style={{ background: "var(--color-surface-2)", padding: "0.5rem", borderRadius: "0.5rem", border: "1px solid var(--color-border)", color: "var(--color-cream)" }}
            />
          </div>
          {loading && <Loader2 size={18} className="animate-spin" style={{ alignSelf: "center", color: "var(--color-muted)" }} />}
        </div>

        {!contatoId && (
          <p style={{ color: "var(--color-warning, #e0a030)", fontSize: "0.85rem", marginBottom: "1rem" }}>
            Este profissional ainda não está vinculado a um Contato do Financeiro — a meta não pode ser salva.
          </p>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>

          {/* Seção Serviços */}
          <div style={{ background: "rgba(255,255,255,0.02)", padding: "1.5rem", borderRadius: "0.5rem", border: "1px solid var(--color-border)" }}>
            <h4 style={{ color: "var(--color-gold)", marginBottom: "1rem", fontSize: "1.1rem" }}>Serviços</h4>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.9rem", color: "var(--color-cream-dim)", marginBottom: "0.5rem" }}>Meta de Serviços (R$):</label>
              <input type="number" value={currentMetas.metaServicos} onChange={e => handleChange("metaServicos", Number(e.target.value))} style={{ width: "100%", background: "var(--color-surface)", border: "1px solid var(--color-border)", padding: "0.5rem", borderRadius: "0.25rem", color: "var(--color-cream)" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.9rem", color: "var(--color-cream-dim)", marginBottom: "0.5rem" }}>Bônus ao Bater (R$):</label>
              <input type="number" value={currentMetas.bonusServicos} onChange={e => handleChange("bonusServicos", Number(e.target.value))} style={{ width: "100%", background: "var(--color-surface)", border: "1px solid var(--color-border)", padding: "0.5rem", borderRadius: "0.25rem", color: "var(--color-cream)" }} />
            </div>
          </div>

          {/* Seção Produtos */}
          <div style={{ background: "rgba(255,255,255,0.02)", padding: "1.5rem", borderRadius: "0.5rem", border: "1px solid var(--color-border)" }}>
            <h4 style={{ color: "#3498db", marginBottom: "1rem", fontSize: "1.1rem" }}>Produtos</h4>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.9rem", color: "var(--color-cream-dim)", marginBottom: "0.5rem" }}>Meta de Produtos (R$):</label>
              <input type="number" value={currentMetas.metaProdutos} onChange={e => handleChange("metaProdutos", Number(e.target.value))} style={{ width: "100%", background: "var(--color-surface)", border: "1px solid var(--color-border)", padding: "0.5rem", borderRadius: "0.25rem", color: "var(--color-cream)" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.9rem", color: "var(--color-cream-dim)", marginBottom: "0.5rem" }}>Bônus ao Bater (R$):</label>
              <input type="number" value={currentMetas.bonusProdutos} onChange={e => handleChange("bonusProdutos", Number(e.target.value))} style={{ width: "100%", background: "var(--color-surface)", border: "1px solid var(--color-border)", padding: "0.5rem", borderRadius: "0.25rem", color: "var(--color-cream)" }} />
            </div>
          </div>

          {/* Seção Ticket Médio */}
          <div style={{ background: "rgba(255,255,255,0.02)", padding: "1.5rem", borderRadius: "0.5rem", border: "1px solid var(--color-border)" }}>
            <h4 style={{ color: "#2ecc71", marginBottom: "1rem", fontSize: "1.1rem" }}>Ticket Médio</h4>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.9rem", color: "var(--color-cream-dim)", marginBottom: "0.5rem" }}>Meta de Ticket (R$):</label>
              <input type="number" value={currentMetas.metaTicket} onChange={e => handleChange("metaTicket", Number(e.target.value))} style={{ width: "100%", background: "var(--color-surface)", border: "1px solid var(--color-border)", padding: "0.5rem", borderRadius: "0.25rem", color: "var(--color-cream)" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.9rem", color: "var(--color-cream-dim)", marginBottom: "0.5rem" }}>Bônus ao Bater (R$):</label>
              <input type="number" value={currentMetas.bonusTicket} onChange={e => handleChange("bonusTicket", Number(e.target.value))} style={{ width: "100%", background: "var(--color-surface)", border: "1px solid var(--color-border)", padding: "0.5rem", borderRadius: "0.25rem", color: "var(--color-cream)" }} />
            </div>
          </div>

        </div>

        <div style={{ marginTop: "2rem", display: "flex", alignItems: "center", gap: "1rem" }}>
          <button onClick={handleSave} disabled={saving || !contatoId} className="btn-primary" style={{ display: "flex", alignItems: "center", gap: "0.5rem", opacity: (saving || !contatoId) ? 0.6 : 1 }}>
            <Save size={16} /> {saving ? "Salvando..." : "Salvar Metas"}
          </button>
          {saved && <span style={{ color: "var(--color-success)", fontSize: "0.9rem" }}>Metas salvas com sucesso!</span>}
        </div>
      </div>
    </div>
  );
}
