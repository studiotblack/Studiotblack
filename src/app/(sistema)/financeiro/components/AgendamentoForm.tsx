"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { Contato, ContaBancaria, CategoriaFinanceira, CentroCusto, TipoAgendamento } from "@/lib/financeiro-data";

interface AgendamentoFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  tipoInicial?: TipoAgendamento;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function AgendamentoForm({ isOpen, onClose, onSaved, tipoInicial = "pagar" }: AgendamentoFormProps) {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>([]);
  const [centros, setCentros] = useState<CentroCusto[]>([]);

  const [tipo, setTipo] = useState<TipoAgendamento>(tipoInicial);
  const [contatoId, setContatoId] = useState("");
  const [valor, setValor] = useState<number>(0);
  const [dataVencimento, setDataVencimento] = useState(today());
  const [dataCompetencia, setDataCompetencia] = useState(today());
  const [dataPrevisao, setDataPrevisao] = useState("");
  const [descricao, setDescricao] = useState("");
  const [referencia, setReferencia] = useState("");
  const [detalhamento, setDetalhamento] = useState("");
  const [contaBancariaId, setContaBancariaId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [centroCustoId, setCentroCustoId] = useState("");
  const [reembolsavel, setReembolsavel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setTipo(tipoInicial);
    Promise.all([
      fetch("/api/financeiro/contatos").then(r => r.ok ? r.json() : []),
      fetch("/api/financeiro/contas-bancarias").then(r => r.ok ? r.json() : []),
      fetch("/api/financeiro/categorias").then(r => r.ok ? r.json() : []),
      fetch("/api/financeiro/centros-custo").then(r => r.ok ? r.json() : []),
    ]).then(([c, b, cat, cc]) => {
      setContatos(c); setContas(b); setCategorias(cat); setCentros(cc);
    });
  }, [isOpen, tipoInicial]);

  if (!isOpen) return null;

  // Papel esperado do contato de acordo com o tipo do agendamento
  const papelEsperado = tipo === "pagar" ? ["fornecedor", "funcionario", "socio"] : ["cliente"];
  const contatosFiltrados = contatos.filter(c => c.ativo && c.tipos.some(t => papelEsperado.includes(t)));
  const categoriasFiltradas = categorias.filter(c => c.tipo === (tipo === "pagar" ? "saida" : "entrada"));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    if (!contatoId || valor <= 0 || !descricao) {
      setErro("Contato, valor e descrição são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/financeiro/agendamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo, contatoId, valor, dataVencimento, dataCompetencia,
          dataPrevisao: dataPrevisao || undefined, descricao, referencia, detalhamento,
          contaBancariaId: contaBancariaId || undefined, categoriaId: categoriaId || undefined,
          centroCustoId: centroCustoId || undefined, reembolsavel,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onSaved();
      onClose();
      // reset
      setValor(0); setDescricao(""); setReferencia(""); setDetalhamento(""); setContatoId("");
    } catch (err: any) {
      setErro(err.message || "Erro ao salvar agendamento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 560 }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>Novo Agendamento</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.1rem", maxHeight: "70vh", overflowY: "auto" }}>
          {erro && <div style={{ background: "rgba(231,76,60,0.1)", border: "1px solid var(--color-danger)", color: "var(--color-danger)", padding: "0.6rem 0.85rem", borderRadius: "0.5rem", fontSize: "0.85rem" }}>{erro}</div>}

          <div>
            <label className="form-label">Tipo</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              {(["pagar", "receber"] as TipoAgendamento[]).map(t => (
                <button key={t} type="button" onClick={() => { setTipo(t); setContatoId(""); setCategoriaId(""); }}
                  style={{
                    padding: "0.625rem", borderRadius: "0.5rem", cursor: "pointer", fontWeight: 600, fontSize: "0.8125rem",
                    background: tipo === t ? (t === "receber" ? "rgba(46,204,113,0.2)" : "rgba(231,76,60,0.2)") : "var(--color-surface-2)",
                    color: tipo === t ? (t === "receber" ? "var(--color-success)" : "var(--color-danger)") : "var(--color-muted)",
                    border: `1px solid ${tipo === t ? (t === "receber" ? "var(--color-success)" : "var(--color-danger)") : "var(--color-border)"}`,
                  }}
                >
                  {t === "pagar" ? "↓ Conta a Pagar" : "↑ Conta a Receber"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="form-label">{tipo === "pagar" ? "Fornecedor / Funcionário / Sócio" : "Cliente"}</label>
            <select value={contatoId} onChange={e => setContatoId(e.target.value)} required>
              <option value="">Selecione...</option>
              {contatosFiltrados.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            {contatosFiltrados.length === 0 && (
              <p style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginTop: "0.3rem" }}>
                Nenhum contato com esse papel cadastrado ainda — cadastre em Cadastros → Contatos.
              </p>
            )}
          </div>

          <div>
            <label className="form-label">Descrição</label>
            <input type="text" placeholder="Ex: Aluguel imóvel Agosto/2026" value={descricao} onChange={e => setDescricao(e.target.value)} required />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label className="form-label">Valor (R$)</label>
              <input type="number" step="0.01" min={0.01} value={valor || ""} onChange={e => setValor(Number(e.target.value))} required />
            </div>
            <div>
              <label className="form-label">Conta Bancária</label>
              <select value={contaBancariaId} onChange={e => setContaBancariaId(e.target.value)}>
                <option value="">Sem conta definida</option>
                {contas.filter(c => c.ativa).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label className="form-label">Vencimento</label>
              <input type="date" value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} required />
            </div>
            <div>
              <label className="form-label">Competência</label>
              <input type="date" value={dataCompetencia} onChange={e => setDataCompetencia(e.target.value)} required />
            </div>
            <div>
              <label className="form-label">Previsão (opcional)</label>
              <input type="date" value={dataPrevisao} onChange={e => setDataPrevisao(e.target.value)} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label className="form-label">Categoria</label>
              <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)}>
                <option value="">Sem categoria</option>
                {categoriasFiltradas.map(c => <option key={c.id} value={c.id}>{c.grupo} — {c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Centro de Custo</label>
              <select value={centroCustoId} onChange={e => setCentroCustoId(e.target.value)}>
                <option value="">Sem centro de custo</option>
                {centros.filter(c => c.ativo).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Referência / Detalhamento (opcional)</label>
            <input type="text" placeholder="Referência" value={referencia} onChange={e => setReferencia(e.target.value)} style={{ marginBottom: "0.5rem" }} />
            <textarea placeholder="Detalhamento" value={detalhamento} onChange={e => setDetalhamento(e.target.value)} rows={2} />
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "var(--color-cream-dim)", cursor: "pointer" }}>
            <input type="checkbox" checked={reembolsavel} onChange={e => setReembolsavel(e.target.checked)} style={{ width: "auto" }} />
            Reembolsável (será cobrado de terceiro depois)
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.25rem" }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-gold" disabled={saving}>{saving ? "Salvando..." : "Salvar Agendamento"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
