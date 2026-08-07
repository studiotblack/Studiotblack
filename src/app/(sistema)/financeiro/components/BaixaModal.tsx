"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { Agendamento, ContaBancaria } from "@/lib/financeiro-data";

interface BaixaModalProps {
  agendamento: Agendamento | null;
  onClose: () => void;
  onSaved: () => void;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function BaixaModal({ agendamento, onClose, onSaved }: BaixaModalProps) {
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [valor, setValor] = useState(0);
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [contaBancariaId, setContaBancariaId] = useState("");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!agendamento) return;
    setValor(Number((agendamento.valor - agendamento.valorPago).toFixed(2)));
    setContaBancariaId(agendamento.contaBancariaId || "");
    setErro("");
    fetch("/api/financeiro/contas-bancarias").then(r => r.ok ? r.json() : []).then(setContas);
  }, [agendamento]);

  if (!agendamento) return null;

  const saldoAberto = agendamento.valor - agendamento.valorPago;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    if (valor <= 0 || !contaBancariaId) {
      setErro("Valor e conta bancária são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/financeiro/agendamentos/${agendamento.id}/baixas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor, data, contaBancariaId, observacao }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onSaved();
      onClose();
    } catch (err: any) {
      setErro(err.message || "Erro ao registrar baixa");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 440 }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>
            {agendamento.tipo === "pagar" ? "Registrar Pagamento" : "Registrar Recebimento"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--color-cream-dim)" }}>
            {agendamento.descricao} — <strong>{agendamento.contatoNome}</strong>
            <br />
            <span style={{ color: "var(--color-muted)" }}>Saldo em aberto: {brl(saldoAberto)}</span>
          </div>

          {erro && <div style={{ background: "rgba(231,76,60,0.1)", border: "1px solid var(--color-danger)", color: "var(--color-danger)", padding: "0.6rem 0.85rem", borderRadius: "0.5rem", fontSize: "0.85rem" }}>{erro}</div>}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label className="form-label">Valor (R$)</label>
              <input type="number" step="0.01" min={0.01} max={saldoAberto} value={valor || ""} onChange={e => setValor(Number(e.target.value))} required />
            </div>
            <div>
              <label className="form-label">Data</label>
              <input type="date" value={data} onChange={e => setData(e.target.value)} required />
            </div>
          </div>

          <div>
            <label className="form-label">Conta Bancária</label>
            <select value={contaBancariaId} onChange={e => setContaBancariaId(e.target.value)} required>
              <option value="">Selecione...</option>
              {contas.filter(c => c.ativa).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="form-label">Observação (opcional)</label>
            <input type="text" value={observacao} onChange={e => setObservacao(e.target.value)} />
          </div>

          {valor > 0 && valor < saldoAberto && (
            <p style={{ fontSize: "0.75rem", color: "var(--color-warning)" }}>
              Baixa parcial — vai restar {brl(saldoAberto - valor)} em aberto.
            </p>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.25rem" }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-gold" disabled={saving}>{saving ? "Salvando..." : "Confirmar"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
