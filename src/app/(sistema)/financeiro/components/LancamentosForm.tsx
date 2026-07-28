"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { DRELancamento, DREGrupo } from "@/lib/dre-data";
import { CATEGORIAS_DEFAULT } from "@/lib/dre-data";

interface LancamentosFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (lancamento: DRELancamento) => void;
  // Prefill quando aberto a partir do painel
  prefillGrupo?: DREGrupo;
  prefillSub?: string;
  prefillMes?: number;
}

const GRUPOS: { value: DREGrupo; label: string }[] = [
  { value: "receita",       label: "Receita"               },
  { value: "custo",         label: "Custo Operacional"     },
  { value: "despesa",       label: "Despesa Operacional"   },
  { value: "investimento",  label: "Investimento"          },
  { value: "financiamento", label: "Financiamento"         },
];

export default function LancamentosForm({
  isOpen, onClose, onSave, prefillGrupo, prefillSub, prefillMes,
}: LancamentosFormProps) {
  const today = new Date().toISOString().slice(0, 10);

  const [grupo, setGrupo]       = useState<DREGrupo>(prefillGrupo ?? "receita");
  const initialSub = prefillSub ?? Object.keys(CATEGORIAS_DEFAULT[prefillGrupo ?? "receita"])[0];
  const [sub, setSub]           = useState(initialSub);
  const [subsub, setSubsub]     = useState(CATEGORIAS_DEFAULT[prefillGrupo ?? "receita"][initialSub]?.[0] || "");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor]       = useState<number>(0);
  const [tipo, setTipo]         = useState<"ENTRADA" | "SAIDA">(
    prefillGrupo === "receita" ? "ENTRADA" : "SAIDA"
  );
  const [origem, setOrigem]     = useState<"caixa" | "banco">("caixa");
  const [data, setData]         = useState(() => {
    if (prefillMes) {
      const year = new Date().getFullYear();
      return `${year}-${String(prefillMes).padStart(2, "0")}-01`;
    }
    return today;
  });

  // Update subcategoria when grupo changes
  const handleGrupoChange = (g: DREGrupo) => {
    setGrupo(g);
    const firstSub = Object.keys(CATEGORIAS_DEFAULT[g])[0];
    setSub(firstSub);
    setSubsub(CATEGORIAS_DEFAULT[g][firstSub]?.[0] || "");
    setTipo(g === "receita" ? "ENTRADA" : "SAIDA");
  };

  const handleSubChange = (s: string) => {
    setSub(s);
    setSubsub(CATEGORIAS_DEFAULT[grupo][s]?.[0] || "");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao || valor <= 0) return;

    const newLancamento: DRELancamento = {
      id: `manual-${Date.now()}`,
      data,
      descricao,
      valor,
      tipo,
      grupo,
      subcategoria: sub,
      subsubcategoria: subsub || undefined,
      origem,
    };

    onSave(newLancamento);
    // Reset
    setDescricao("");
    setValor(0);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 520 }}>
        {/* Header */}
        <div style={{
          padding: "1.25rem 1.5rem",
          borderBottom: "1px solid var(--color-border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>
            Novo Lançamento DRE
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Data */}
          <div>
            <label className="form-label">Data do Lançamento</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)} required />
          </div>

          {/* Descrição */}
          <div>
            <label className="form-label">Descrição</label>
            <input
              type="text"
              placeholder="Ex: Aluguel imóvel Junho/2026"
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              required
            />
          </div>

          {/* Tipo (Entrada/Saída) */}
          <div>
            <label className="form-label">Tipo</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              {(["ENTRADA", "SAIDA"] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  style={{
                    padding: "0.625rem",
                    borderRadius: "0.5rem", cursor: "pointer",
                    fontWeight: 600, fontSize: "0.8125rem",
                    background: tipo === t
                      ? (t === "ENTRADA" ? "rgba(46,204,113,0.2)" : "rgba(231,76,60,0.2)")
                      : "var(--color-surface-2)",
                    color: tipo === t
                      ? (t === "ENTRADA" ? "var(--color-success)" : "var(--color-danger)")
                      : "var(--color-muted)",
                    border: `1px solid ${tipo === t
                      ? (t === "ENTRADA" ? "var(--color-success)" : "var(--color-danger)")
                      : "var(--color-border)"}`,
                  }}
                >
                  {t === "ENTRADA" ? "↑ Entrada / Receita" : "↓ Saída / Despesa"}
                </button>
              ))}
            </div>
          </div>

          {/* Grupo + Subcategoria */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label className="form-label">Grupo DRE</label>
              <select value={grupo} onChange={e => handleGrupoChange(e.target.value as DREGrupo)}>
                {GRUPOS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Subcategoria</label>
              <select value={sub} onChange={e => handleSubChange(e.target.value)}>
                {Object.keys(CATEGORIAS_DEFAULT[grupo]).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          
          {/* Sub-subcategoria */}
          {CATEGORIAS_DEFAULT[grupo][sub]?.length > 0 && (
            <div>
              <label className="form-label">Detalhe (Sub-subcategoria)</label>
              <select value={subsub} onChange={e => setSubsub(e.target.value)}>
                {CATEGORIAS_DEFAULT[grupo][sub].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {/* Valor + Origem */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label className="form-label">Valor (R$)</label>
              <input
                type="number"
                value={valor || ""}
                onChange={e => setValor(Number(e.target.value))}
                min={0.01} step={0.01}
                placeholder="0,00"
                required
              />
            </div>
            <div>
              <label className="form-label">Origem</label>
              <select value={origem} onChange={e => setOrigem(e.target.value as "caixa" | "banco")}>
                <option value="caixa">Caixa (dinheiro/POS)</option>
                <option value="banco">Banco (transferência)</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-gold">Salvar Lançamento</button>
          </div>
        </form>
      </div>
    </div>
  );
}
