"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Check, Search, Trash2 } from "lucide-react";
import type { Agendamento, TipoAgendamento, StatusAgendamento } from "@/lib/financeiro-data";
import { statusAgendamento, STATUS_LABELS, STATUS_COLORS } from "@/lib/financeiro-data";
import AgendamentoForm from "./AgendamentoForm";
import BaixaModal from "./BaixaModal";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d: string) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";

export default function AgendamentosTable() {
  const [tipo, setTipo] = useState<TipoAgendamento>("pagar");
  const [statusFiltro, setStatusFiltro] = useState<StatusAgendamento | "todos">("todos");
  const [busca, setBusca] = useState("");
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [baixaAlvo, setBaixaAlvo] = useState<Agendamento | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/financeiro/agendamentos?tipo=${tipo}`);
      setAgendamentos(res.ok ? await res.json() : []);
    } catch (err) {
      console.error("Erro ao carregar agendamentos:", err);
    } finally {
      setLoading(false);
    }
  }, [tipo]);

  useEffect(() => { carregar(); }, [carregar]);

  const excluir = async (id: string) => {
    if (!confirm("Excluir este agendamento? (só é possível se não tiver nenhuma baixa registrada)")) return;
    const res = await fetch(`/api/financeiro/agendamentos/${id}`, { method: "DELETE" });
    if (!res.ok) alert((await res.json()).error || "Erro ao excluir");
    carregar();
  };

  const filtrados = useMemo(() => {
    return agendamentos
      .map(a => ({ ...a, status: statusAgendamento(a) }))
      .filter(a => statusFiltro === "todos" || a.status === statusFiltro)
      .filter(a => !busca || a.descricao.toLowerCase().includes(busca.toLowerCase()) || a.contatoNome?.toLowerCase().includes(busca.toLowerCase()));
  }, [agendamentos, statusFiltro, busca]);

  const totalAberto = filtrados.filter(a => a.status !== "pago").reduce((acc, a) => acc + (a.valor - a.valorPago), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {(["pagar", "receber"] as TipoAgendamento[]).map(t => (
            <button key={t} onClick={() => setTipo(t)} className={tipo === t ? "btn btn-gold btn-sm" : "btn btn-ghost btn-sm"}>
              {t === "pagar" ? "Contas a Pagar" : "Contas a Receber"}
            </button>
          ))}
        </div>
        <button className="btn btn-gold" onClick={() => setShowForm(true)}><Plus size={16} /> Novo Agendamento</button>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={14} color="var(--color-muted)" style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)" }} />
          <input placeholder="Buscar descrição ou contato..." value={busca} onChange={e => setBusca(e.target.value)} style={{ paddingLeft: "2.25rem" }} />
        </div>
        <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value as any)} style={{ width: "auto" }}>
          <option value="todos">Todos os status</option>
          <option value="aberto">Em aberto</option>
          <option value="parcial">Parcialmente pago</option>
          <option value="vencido">Vencido</option>
          <option value="pago">Quitado</option>
        </select>
        <span style={{ fontSize: "0.85rem", color: "var(--color-muted)" }}>
          {filtrados.length} lançamento{filtrados.length !== 1 ? "s" : ""} · em aberto: <strong style={{ color: "var(--color-gold)" }}>{brl(totalAberto)}</strong>
        </span>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Vencimento</th><th>{tipo === "pagar" ? "Fornecedor/Funcionário/Sócio" : "Cliente"}</th>
              <th>Descrição</th><th>Categoria</th><th>Status</th>
              <th style={{ textAlign: "right" }}>Valor</th><th style={{ textAlign: "right" }}>Pago</th><th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "var(--color-muted)" }}>Carregando...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: "3rem", color: "var(--color-muted)" }}>Nenhum agendamento encontrado.</td></tr>
            ) : filtrados.map(a => (
              <tr key={a.id}>
                <td style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>{fmtData(a.dataVencimento)}</td>
                <td style={{ fontWeight: 500 }}>{a.contatoNome}</td>
                <td style={{ fontSize: "0.85rem", color: "var(--color-cream-dim)" }}>{a.descricao}</td>
                <td style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>{a.categoriaNome || "—"}</td>
                <td>
                  <span className="badge" style={{ background: `${STATUS_COLORS[a.status]}22`, color: STATUS_COLORS[a.status], border: `1px solid ${STATUS_COLORS[a.status]}55` }}>
                    {STATUS_LABELS[a.status]}
                  </span>
                </td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{brl(a.valor)}</td>
                <td style={{ textAlign: "right", color: "var(--color-muted)" }}>{brl(a.valorPago)}</td>
                <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                  {a.status !== "pago" && (
                    <button onClick={() => setBaixaAlvo(a)} title="Registrar pagamento/recebimento" style={{ background: "none", border: "none", color: "var(--color-success)", cursor: "pointer", marginRight: "0.5rem" }}>
                      <Check size={16} />
                    </button>
                  )}
                  {a.valorPago === 0 && (
                    <button onClick={() => excluir(a.id)} title="Excluir" style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer" }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AgendamentoForm isOpen={showForm} onClose={() => setShowForm(false)} onSaved={carregar} tipoInicial={tipo} />
      <BaixaModal agendamento={baixaAlvo} onClose={() => setBaixaAlvo(null)} onSaved={carregar} />
    </div>
  );
}
