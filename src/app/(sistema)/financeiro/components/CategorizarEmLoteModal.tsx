"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle2, XCircle } from "lucide-react";
import type { Agendamento, CategoriaFinanceira } from "@/lib/financeiro-data";
import CategoriaCombobox from "./CategoriaCombobox";

interface CategorizarEmLoteModalProps {
  agendamentos: Agendamento[];
  categorias: CategoriaFinanceira[];
  onClose: () => void;
  onSaved: () => void;
}

// ── Troca a categoria de vários agendamentos de uma vez. PATCH /agendamentos/[id]
// substitui o registro inteiro (não é um patch parcial de verdade) — por isso cada
// chamada reconstrói o payload completo a partir do agendamento já carregado em memória,
// só trocando a categoriaId, em vez de mandar só o campo que mudou.
export default function CategorizarEmLoteModal({ agendamentos, categorias, onClose, onSaved }: CategorizarEmLoteModalProps) {
  const [categoriaId, setCategoriaId] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<{ id: string; label: string; ok: boolean; erro?: string }[] | null>(null);

  useEffect(() => {
    setCategoriaId("");
    setErro("");
    setResultado(null);
  }, [agendamentos]);

  if (agendamentos.length === 0) return null;

  const tipoCategoria = agendamentos[0].tipo === "pagar" ? "saida" : "entrada";

  const confirmar = async () => {
    setErro("");
    if (!categoriaId) { setErro("Selecione a categoria."); return; }
    setSaving(true);
    const itens: { id: string; label: string; ok: boolean; erro?: string }[] = [];
    for (const a of agendamentos) {
      try {
        const res = await fetch(`/api/financeiro/agendamentos/${a.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: a.tipo, contatoId: a.contatoId, valor: a.valor,
            dataVencimento: a.dataVencimento || undefined, dataCompetencia: a.dataCompetencia,
            dataPrevisao: a.dataPrevisao || undefined, descricao: a.descricao,
            referencia: a.referencia, detalhamento: a.detalhamento,
            contaBancariaId: a.contaBancariaId || undefined, recorrencia: a.recorrencia || undefined,
            categoriaId, centroCustoId: a.centroCustoId || undefined,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        itens.push({ id: a.id, label: `${a.descricao} — ${a.contatoNome}`, ok: true });
      } catch (err: any) {
        itens.push({ id: a.id, label: `${a.descricao} — ${a.contatoNome}`, ok: false, erro: err.message || "erro desconhecido" });
      }
    }
    setResultado(itens);
    setSaving(false);
    onSaved();
  };

  const sucessos = resultado?.filter(r => r.ok).length ?? 0;
  const falhas = resultado?.filter(r => !r.ok).length ?? 0;

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 460 }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>Categorizar em lote</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {!resultado ? (
            <>
              <p style={{ fontSize: "0.85rem", color: "var(--color-cream-dim)", margin: 0 }}>
                Aplica a categoria escolhida a <strong>{agendamentos.length}</strong> agendamento{agendamentos.length === 1 ? "" : "s"} selecionado{agendamentos.length === 1 ? "" : "s"}.
              </p>

              {erro && <div style={{ background: "rgba(231,76,60,0.1)", border: "1px solid var(--color-danger)", color: "var(--color-danger)", padding: "0.6rem 0.85rem", borderRadius: "0.5rem", fontSize: "0.85rem" }}>{erro}</div>}

              <div>
                <label className="form-label">Categoria</label>
                <CategoriaCombobox categorias={categorias} tipo={tipoCategoria} value={categoriaId} onChange={setCategoriaId} />
              </div>

              <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                {agendamentos.map(a => (
                  <div key={a.id} style={{ fontSize: "0.78rem", color: "var(--color-cream-dim)" }}>
                    {a.descricao} — {a.contatoNome}
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.25rem" }}>
                <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
                <button type="button" className="btn btn-gold" onClick={confirmar} disabled={saving}>{saving ? "Processando..." : "Aplicar"}</button>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: "0.85rem", color: "var(--color-cream-dim)", margin: 0 }}>
                {sucessos} atualizado{sucessos === 1 ? "" : "s"}{falhas > 0 ? `, ${falhas} falharam` : ""}.
              </p>
              <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {resultado.map(r => (
                  <div key={r.id} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.8rem" }}>
                    {r.ok ? <CheckCircle2 size={14} color="var(--color-success)" style={{ flexShrink: 0, marginTop: 2 }} /> : <XCircle size={14} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: 2 }} />}
                    <span style={{ color: r.ok ? "var(--color-cream-dim)" : "var(--color-danger)" }}>
                      {r.label}{r.erro ? ` — ${r.erro}` : ""}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.25rem" }}>
                <button type="button" className="btn btn-gold" onClick={onClose}>Fechar</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
