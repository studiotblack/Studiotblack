"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle2, XCircle } from "lucide-react";
import type { Agendamento, ContaBancaria } from "@/lib/financeiro-data";

interface BaixaEmLoteModalProps {
  agendamentos: Agendamento[];
  onClose: () => void;
  onSaved: () => void;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ── Dá baixa TOTAL em vários agendamentos de uma vez, com a mesma data/conta bancária pra
// todos. Não existe endpoint de batch no backend — só chama a rota de baixa já existente
// (agendamentos/[id]/baixas) uma vez por item, sequencialmente, e reporta o resultado de
// cada um (baixa parcial em lote não faz sentido: cada item tem um saldo diferente, então
// "dar baixa em lote" aqui sempre significa quitar cada um inteiro).
export default function BaixaEmLoteModal({ agendamentos, onClose, onSaved }: BaixaEmLoteModalProps) {
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [contaBancariaId, setContaBancariaId] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<{ id: string; label: string; ok: boolean; erro?: string }[] | null>(null);

  useEffect(() => {
    if (agendamentos.length === 0) return;
    setData(new Date().toISOString().slice(0, 10));
    setContaBancariaId(agendamentos[0]?.contaBancariaId || "");
    setErro("");
    setResultado(null);
    fetch("/api/financeiro/contas-bancarias").then(r => r.ok ? r.json() : []).then(setContas);
  }, [agendamentos]);

  if (agendamentos.length === 0) return null;

  const totalGeral = agendamentos.reduce((acc, a) => acc + (a.valor - a.valorPago), 0);

  const confirmar = async () => {
    setErro("");
    if (!contaBancariaId) { setErro("Selecione a conta bancária."); return; }
    setSaving(true);
    const itens: { id: string; label: string; ok: boolean; erro?: string }[] = [];
    for (const a of agendamentos) {
      const saldo = Number((a.valor - a.valorPago).toFixed(2));
      try {
        const res = await fetch(`/api/financeiro/agendamentos/${a.id}/baixas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ valor: saldo, data, contaBancariaId }),
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
      <div className="modal-box" style={{ maxWidth: 480 }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>Dar baixa em lote</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {!resultado ? (
            <>
              <div style={{ fontSize: "0.85rem", color: "var(--color-cream-dim)" }}>
                Quita <strong>{agendamentos.length}</strong> agendamento{agendamentos.length === 1 ? "" : "s"} por inteiro, todos com a mesma data e conta.
                <br />
                <span style={{ color: "var(--color-muted)" }}>Total: {brl(totalGeral)}</span>
              </div>

              {erro && <div style={{ background: "rgba(231,76,60,0.1)", border: "1px solid var(--color-danger)", color: "var(--color-danger)", padding: "0.6rem 0.85rem", borderRadius: "0.5rem", fontSize: "0.85rem" }}>{erro}</div>}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label className="form-label">Data</label>
                  <input type="date" value={data} onChange={e => setData(e.target.value)} required />
                </div>
                <div>
                  <label className="form-label">Conta Bancária</label>
                  <select value={contaBancariaId} onChange={e => setContaBancariaId(e.target.value)} required>
                    <option value="">Selecione...</option>
                    {contas.filter(c => c.ativa).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                {agendamentos.map(a => (
                  <div key={a.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--color-cream-dim)" }}>
                    <span>{a.descricao} — {a.contatoNome}</span>
                    <span>{brl(a.valor - a.valorPago)}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.25rem" }}>
                <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
                <button type="button" className="btn btn-gold" onClick={confirmar} disabled={saving}>{saving ? "Processando..." : `Confirmar ${agendamentos.length} baixa${agendamentos.length === 1 ? "" : "s"}`}</button>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: "0.85rem", color: "var(--color-cream-dim)", margin: 0 }}>
                {sucessos} baixado{sucessos === 1 ? "" : "s"}{falhas > 0 ? `, ${falhas} falharam` : ""}.
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
