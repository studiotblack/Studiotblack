"use client";

import { useState, useEffect } from "react";
import { X, Landmark } from "lucide-react";
import type { ContaBancaria, Contato, CategoriaFinanceira, CentroCusto } from "@/lib/financeiro-data";

interface SicoobConfigModalProps {
  conta: ContaBancaria | null;
  contatos: Contato[];
  categorias: CategoriaFinanceira[];
  centros: CentroCusto[];
  onClose: () => void;
  onSaved: () => void;
}

export default function SicoobConfigModal({ conta, contatos, categorias, centros, onClose, onSaved }: SicoobConfigModalProps) {
  const [clientId, setClientId] = useState("");
  const [numeroConta, setNumeroConta] = useState("");
  const [certificado, setCertificado] = useState("");
  const [chavePrivada, setChavePrivada] = useState("");
  const [regraAtiva, setRegraAtiva] = useState(false);
  const [regraContatoId, setRegraContatoId] = useState("");
  const [regraCategoriaId, setRegraCategoriaId] = useState("");
  const [regraCentroCustoId, setRegraCentroCustoId] = useState("");
  const [regraSaidaAtiva, setRegraSaidaAtiva] = useState(false);
  const [regraSaidaContatoId, setRegraSaidaContatoId] = useState("");
  const [regraSaidaCategoriaId, setRegraSaidaCategoriaId] = useState("");
  const [regraSaidaCentroCustoId, setRegraSaidaCentroCustoId] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!conta) return;
    setClientId(conta.sicoobClientId || "");
    setNumeroConta(conta.sicoobNumeroConta || conta.conta || "");
    setCertificado(conta.sicoobCertificado || "");
    setChavePrivada(conta.sicoobChavePrivada || "");
    setRegraAtiva(conta.regraEntradaAtiva || false);
    setRegraContatoId(conta.regraEntradaContatoId || "");
    setRegraCategoriaId(conta.regraEntradaCategoriaId || "");
    setRegraCentroCustoId(conta.regraEntradaCentroCustoId || "");
    setRegraSaidaAtiva(conta.regraSaidaAtiva || false);
    setRegraSaidaContatoId(conta.regraSaidaContatoId || "");
    setRegraSaidaCategoriaId(conta.regraSaidaCategoriaId || "");
    setRegraSaidaCentroCustoId(conta.regraSaidaCentroCustoId || "");
    setErro("");
  }, [conta]);

  if (!conta) return null;

  const jaConectada = !!conta.sicoobClientId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    if (!clientId || !numeroConta || !certificado || !chavePrivada) {
      setErro("Client ID, número da conta, certificado e chave privada são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/financeiro/contas-bancarias", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: conta.id,
          sicoobClientId: clientId,
          sicoobNumeroConta: numeroConta,
          sicoobCertificado: certificado,
          sicoobChavePrivada: chavePrivada,
          regraEntradaAtiva: regraAtiva,
          regraEntradaContatoId: regraAtiva ? (regraContatoId || null) : null,
          regraEntradaCategoriaId: regraAtiva ? (regraCategoriaId || null) : null,
          regraEntradaCentroCustoId: regraAtiva ? (regraCentroCustoId || null) : null,
          regraSaidaAtiva: regraSaidaAtiva,
          regraSaidaContatoId: regraSaidaAtiva ? (regraSaidaContatoId || null) : null,
          regraSaidaCategoriaId: regraSaidaAtiva ? (regraSaidaCategoriaId || null) : null,
          regraSaidaCentroCustoId: regraSaidaAtiva ? (regraSaidaCentroCustoId || null) : null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onSaved();
      onClose();
    } catch (err: any) {
      setErro(err.message || "Erro ao salvar configuração Sicoob");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 560 }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Landmark size={18} color="var(--color-gold)" /> Conectar {conta.nome} ao Sicoob
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "70vh", overflowY: "auto" }}>
          {jaConectada && (
            <div style={{ background: "rgba(46,204,113,0.08)", border: "1px solid var(--color-success)", color: "var(--color-success)", padding: "0.6rem 0.85rem", borderRadius: "0.5rem", fontSize: "0.8rem" }}>
              Esta conta já está conectada. Os campos abaixo estão preenchidos — só altere o que precisar.
            </div>
          )}
          {erro && <div style={{ background: "rgba(231,76,60,0.1)", border: "1px solid var(--color-danger)", color: "var(--color-danger)", padding: "0.6rem 0.85rem", borderRadius: "0.5rem", fontSize: "0.85rem" }}>{erro}</div>}

          <div>
            <label className="form-label">Client ID</label>
            <input type="text" value={clientId} onChange={e => setClientId(e.target.value)} placeholder="ex: d0feda0d-949f-4468-af12-d6bf34c5a812" required />
          </div>

          <div>
            <label className="form-label">Número da conta corrente (Sicoob)</label>
            <input type="text" value={numeroConta} onChange={e => setNumeroConta(e.target.value)} placeholder="ex: 170.426-5" required />
          </div>

          <div>
            <label className="form-label">Certificado (chave pública, Base-64 .cer)</label>
            <textarea value={certificado} onChange={e => setCertificado(e.target.value)} rows={4} placeholder="-----BEGIN CERTIFICATE-----" style={{ fontFamily: "monospace", fontSize: "0.75rem" }} required />
          </div>

          <div>
            <label className="form-label">Chave privada (.pem)</label>
            <textarea value={chavePrivada} onChange={e => setChavePrivada(e.target.value)} rows={4} placeholder="-----BEGIN PRIVATE KEY-----" style={{ fontFamily: "monospace", fontSize: "0.75rem" }} required />
          </div>

          <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
              <input type="checkbox" checked={regraAtiva} onChange={e => setRegraAtiva(e.target.checked)} />
              <span style={{ fontSize: "0.85rem" }}>
                Classificar automaticamente entradas do extrato que não baterem com nenhuma conta a receber em aberto
              </span>
            </label>

            {regraAtiva && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", paddingLeft: "1.5rem" }}>
                <div>
                  <label className="form-label">Contato padrão (obrigatório)</label>
                  <select value={regraContatoId} onChange={e => setRegraContatoId(e.target.value)} required={regraAtiva}>
                    <option value="">Selecione...</option>
                    {contatos.filter(c => c.ativo).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label className="form-label">Categoria (opcional)</label>
                    <select value={regraCategoriaId} onChange={e => setRegraCategoriaId(e.target.value)}>
                      <option value="">Sem categoria</option>
                      {categorias.filter(c => c.tipo === "entrada").map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Centro de custo (opcional)</label>
                    <select value={regraCentroCustoId} onChange={e => setRegraCentroCustoId(e.target.value)}>
                      <option value="">Sem centro de custo</option>
                      {centros.filter(c => c.ativo).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
              <input type="checkbox" checked={regraSaidaAtiva} onChange={e => setRegraSaidaAtiva(e.target.checked)} />
              <span style={{ fontSize: "0.85rem" }}>
                Categorizar saídas automaticamente a partir dos comprovantes do grupo do WhatsApp
              </span>
            </label>

            {regraSaidaAtiva && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", paddingLeft: "1.5rem" }}>
                <div>
                  <label className="form-label">Contato padrão (fornecedor genérico, obrigatório)</label>
                  <select value={regraSaidaContatoId} onChange={e => setRegraSaidaContatoId(e.target.value)} required={regraSaidaAtiva}>
                    <option value="">Selecione...</option>
                    {contatos.filter(c => c.ativo).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label className="form-label">Categoria padrão (se a legenda não bater com nenhuma palavra-chave)</label>
                    <select value={regraSaidaCategoriaId} onChange={e => setRegraSaidaCategoriaId(e.target.value)}>
                      <option value="">Sem categoria</option>
                      {categorias.filter(c => c.tipo === "saida").map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Centro de custo (opcional)</label>
                    <select value={regraSaidaCentroCustoId} onChange={e => setRegraSaidaCentroCustoId(e.target.value)}>
                      <option value="">Sem centro de custo</option>
                      {centros.filter(c => c.ativo).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                </div>
                <p style={{ fontSize: "0.72rem", color: "var(--color-muted)", margin: 0 }}>
                  A categoria de cada comprovante é decidida primeiro pelo dicionário de palavras-chave
                  (Cadastros → Palavras-chave) — essa aqui só entra se nenhuma palavra bater.
                </p>
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.25rem" }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-gold" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
