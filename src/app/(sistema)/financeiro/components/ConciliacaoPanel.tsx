"use client";

import { useState, useEffect, useMemo } from "react";
import { CheckCircle2, ArrowRightLeft, Bot, X, Link2 } from "lucide-react";
import type {
  ContaBancaria, Contato, CategoriaFinanceira, CentroCusto, Agendamento,
} from "@/lib/financeiro-data";
import { statusAgendamento } from "@/lib/financeiro-data";
import type { TransacaoBancariaImportada } from "@/lib/financeiro-data";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR");

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export default function ConciliacaoPanel() {
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>([]);
  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [transacoes, setTransacoes] = useState<TransacaoBancariaImportada[]>([]);

  const hoje = new Date();
  const [contaId, setContaId] = useState("");
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [resumoSync, setResumoSync] = useState<string | null>(null);
  const [erroSync, setErroSync] = useState<string | null>(null);

  const [resolveTx, setResolveTx] = useState<TransacaoBancariaImportada | null>(null);

  const contasConectadas = useMemo(() => contas.filter(c => !!c.sicoobClientId), [contas]);
  const contaSelecionada = contas.find(c => c.id === contaId);

  const carregarCadastros = async () => {
    const [rContas, rContatos, rCategorias, rCentros, rPagar, rReceber] = await Promise.all([
      fetch("/api/financeiro/contas-bancarias"),
      fetch("/api/financeiro/contatos"),
      fetch("/api/financeiro/categorias"),
      fetch("/api/financeiro/centros-custo"),
      fetch("/api/financeiro/agendamentos?tipo=pagar"),
      fetch("/api/financeiro/agendamentos?tipo=receber"),
    ]);
    const contasCarregadas: ContaBancaria[] = rContas.ok ? await rContas.json() : [];
    setContas(contasCarregadas);
    setContatos(rContatos.ok ? await rContatos.json() : []);
    setCategorias(rCategorias.ok ? await rCategorias.json() : []);
    setCentros(rCentros.ok ? await rCentros.json() : []);
    const pagar = rPagar.ok ? await rPagar.json() : [];
    const receber = rReceber.ok ? await rReceber.json() : [];
    setAgendamentos([...pagar, ...receber]);

    const conectadas = contasCarregadas.filter(c => !!c.sicoobClientId);
    if (conectadas.length > 0 && !contaId) setContaId(conectadas[0].id);
  };

  const carregarTransacoes = async () => {
    if (!contaId) { setTransacoes([]); return; }
    const res = await fetch(`/api/financeiro/transacoes-bancarias?contaBancariaId=${contaId}&mes=${mes}&ano=${ano}`);
    setTransacoes(res.ok ? await res.json() : []);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await carregarCadastros();
      setLoading(false);
    })();
  }, []);

  useEffect(() => { carregarTransacoes(); }, [contaId, mes, ano]);

  const handleSync = async () => {
    if (!contaId) return;
    setSyncing(true);
    setErroSync(null);
    setResumoSync(null);
    try {
      const res = await fetch(`/api/financeiro/contas-bancarias/${contaId}/sincronizar-sicoob`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes, ano }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResumoSync(
        `Saldo atual: ${brl(data.saldoSicoob)} — ${data.novos} transaç${data.novos === 1 ? "ão nova" : "ões novas"}, ${data.autoConciliados} conciliada${data.autoConciliados === 1 ? "" : "s"} automaticamente, ${data.pendentes} pendente${data.pendentes === 1 ? "" : "s"} pra revisar.`
      );
      await Promise.all([carregarCadastros(), carregarTransacoes()]);
    } catch (err: any) {
      setErroSync(err.message || "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  const pendentes = transacoes.filter(t => t.status === "pendente");
  const conciliadas = transacoes.filter(t => t.status === "conciliado");
  const ignoradas = transacoes.filter(t => t.status === "ignorado");

  const agendamentosCompativeis = (tx: TransacaoBancariaImportada) => {
    const tipoAlvo = tx.tipo === "entrada" ? "receber" : "pagar";
    return agendamentos
      .filter(a => a.tipo === tipoAlvo)
      .filter(a => statusAgendamento(a) !== "pago")
      .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento));
  };

  if (loading) {
    return <div className="card" style={{ textAlign: "center", padding: "2rem", color: "var(--color-muted)" }}>Carregando...</div>;
  }

  if (contasConectadas.length === 0) {
    return (
      <div style={{ padding: "4rem 2rem", textAlign: "center", background: "var(--color-surface)", borderRadius: "1rem", border: "1px dashed var(--color-border)" }}>
        <Link2 size={48} color="var(--color-muted-2)" style={{ margin: "0 auto 1rem auto" }} />
        <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-cream)", marginBottom: "0.5rem" }}>Nenhuma conta conectada ao Sicoob</h3>
        <p style={{ color: "var(--color-muted)" }}>Vá em Cadastros → Contas Bancárias e clique no ícone de link pra configurar as credenciais.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* HEADER E CONTROLES */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "0.5rem", margin: 0 }}>
            <ArrowRightLeft color="var(--color-gold)" size={22} />
            Conciliação Bancária
          </h2>
          <p style={{ color: "var(--color-muted)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Sincronize o extrato real do Sicoob e concilie com as contas a pagar/receber.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <select value={contaId} onChange={e => setContaId(e.target.value)}
            style={{ padding: "0.5rem 1rem", borderRadius: "0.5rem", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-cream)" }}>
            {contasConectadas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <select value={mes} onChange={e => setMes(Number(e.target.value))}
            style={{ padding: "0.5rem 1rem", borderRadius: "0.5rem", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-cream)" }}>
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={ano} onChange={e => setAno(Number(e.target.value))}
            style={{ padding: "0.5rem 1rem", borderRadius: "0.5rem", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-cream)" }}>
            {[hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1].map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          <button className="btn btn-gold" onClick={handleSync} disabled={syncing} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Bot size={16} />
            {syncing ? "Sincronizando..." : "Sincronizar Extrato"}
          </button>
        </div>
      </div>

      {contaSelecionada?.saldoSicoob !== undefined && contaSelecionada?.saldoSicoob !== null && (
        <div className="kpi-card" style={{ maxWidth: 280 }}>
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Saldo Real (Sicoob)</span>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "4px 0 0 0", color: "var(--color-gold)" }}>{brl(contaSelecionada.saldoSicoob)}</h2>
          {contaSelecionada.saldoSicoobAtualizadoEm && (
            <span style={{ fontSize: "0.7rem", color: "var(--color-muted)" }}>
              Atualizado em {new Date(contaSelecionada.saldoSicoobAtualizadoEm).toLocaleString("pt-BR")}
            </span>
          )}
        </div>
      )}

      {erroSync && (
        <div style={{ background: "rgba(231,76,60,0.1)", border: "1px solid var(--color-danger)", color: "var(--color-danger)", padding: "0.75rem 1rem", borderRadius: "0.5rem", fontSize: "0.85rem" }}>
          {erroSync}
        </div>
      )}
      {resumoSync && !erroSync && (
        <div style={{ background: "rgba(46,204,113,0.08)", border: "1px solid var(--color-success)", color: "var(--color-success)", padding: "0.75rem 1rem", borderRadius: "0.5rem", fontSize: "0.85rem" }}>
          {resumoSync}
        </div>
      )}

      {/* PENDENTES */}
      <div style={{ background: "var(--color-surface)", borderRadius: "1rem", border: "1px solid var(--color-border)", overflow: "hidden" }}>
        <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-2)", color: "var(--color-muted)", fontSize: "0.8rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Pendentes de conciliação ({pendentes.length})
        </div>

        {pendentes.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--color-success)" }}>
            <CheckCircle2 size={40} style={{ margin: "0 auto 1rem auto" }} />
            <p style={{ fontWeight: 700, fontSize: "1rem" }}>Tudo conciliado!</p>
            <p style={{ fontSize: "0.85rem", color: "var(--color-muted)" }}>Nenhuma transação pendente neste período.</p>
          </div>
        ) : (
          pendentes.map(tx => (
            <div key={tx.id} style={{ display: "flex", alignItems: "center", padding: "0.85rem 1rem", borderBottom: "1px solid var(--color-border)", gap: "1rem" }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--color-cream)" }}>{tx.descricao}</span>
                <span style={{ fontSize: "0.7rem", color: "var(--color-muted)" }}>{fmtData(tx.data)}{tx.descricaoComplementar ? ` — ${tx.descricaoComplementar}` : ""}</span>
              </div>
              <div style={{ width: "130px", textAlign: "right", fontWeight: 800, color: tx.tipo === "entrada" ? "var(--color-success)" : "var(--color-danger)" }}>
                {tx.tipo === "entrada" ? "+" : "-"}{brl(tx.valor)}
              </div>
              <button onClick={() => setResolveTx(tx)} className="btn btn-gold btn-sm">Conciliar</button>
            </div>
          ))
        )}
      </div>

      {/* CONCILIADAS */}
      {conciliadas.length > 0 && (
        <div className="card">
          <h4 style={{ fontSize: "0.8rem", color: "var(--color-muted)", textTransform: "uppercase", fontWeight: 800, marginBottom: "0.75rem" }}>
            Conciliadas ({conciliadas.length})
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {conciliadas.map(tx => (
              <div key={tx.id} style={{ display: "flex", alignItems: "center", padding: "0.4rem 0", borderBottom: "1px solid var(--color-border)", opacity: 0.7, fontSize: "0.8rem" }}>
                <div style={{ flex: 1, color: "var(--color-cream)" }}>{tx.descricao} {tx.lancamentoDescricao && <span style={{ color: "var(--color-muted)" }}>→ {tx.lancamentoDescricao}</span>}</div>
                <div style={{ width: "100px", textAlign: "right" }}>{tx.tipo === "entrada" ? "+" : "-"}{brl(tx.valor)}</div>
                <div style={{ width: "90px", textAlign: "right", color: "var(--color-success)", fontSize: "0.75rem" }}>✔ Conciliado</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {ignoradas.length > 0 && (
        <p style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>{ignoradas.length} transaç{ignoradas.length === 1 ? "ão ignorada" : "ões ignoradas"} neste período.</p>
      )}

      {/* MODAL DE CONCILIAÇÃO MANUAL */}
      {resolveTx && (
        <ConciliarModal
          tx={resolveTx}
          agendamentos={agendamentosCompativeis(resolveTx)}
          contatos={contatos}
          categorias={categorias}
          centros={centros}
          onClose={() => setResolveTx(null)}
          onSaved={() => { setResolveTx(null); carregarTransacoes(); carregarCadastros(); }}
        />
      )}
    </div>
  );
}

// ── Modal de conciliação manual (bater com conta existente, criar nova, ou ignorar) ──
function ConciliarModal({ tx, agendamentos, contatos, categorias, centros, onClose, onSaved }: {
  tx: TransacaoBancariaImportada;
  agendamentos: Agendamento[];
  contatos: Contato[];
  categorias: CategoriaFinanceira[];
  centros: CentroCusto[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [modo, setModo] = useState<"match" | "novo">(agendamentos.length > 0 ? "match" : "novo");
  const [lancamentoId, setLancamentoId] = useState(agendamentos[0]?.id || "");
  const [contatoId, setContatoId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [centroCustoId, setCentroCustoId] = useState("");
  const [descricao, setDescricao] = useState(tx.descricao || "");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  const categoriasFiltradas = categorias.filter(c => c.tipo === (tx.tipo === "entrada" ? "entrada" : "saida"));

  const salvar = async () => {
    setErro("");
    if (modo === "match" && !lancamentoId) { setErro("Selecione uma conta a pagar/receber."); return; }
    if (modo === "novo" && !contatoId) { setErro("Selecione um contato."); return; }
    setSaving(true);
    try {
      const body = modo === "match"
        ? { lancamentoId }
        : { novoLancamento: { contatoId, categoriaId: categoriaId || undefined, centroCustoId: centroCustoId || undefined, descricao } };
      const res = await fetch(`/api/financeiro/transacoes-bancarias/${tx.id}/conciliar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onSaved();
    } catch (err: any) {
      setErro(err.message || "Erro ao conciliar");
    } finally {
      setSaving(false);
    }
  };

  const ignorar = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/financeiro/transacoes-bancarias/${tx.id}/conciliar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ignorar: true }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onSaved();
    } catch (err: any) {
      setErro(err.message || "Erro ao ignorar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 520 }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>Conciliar Transação</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ padding: "1rem", background: "var(--color-surface-2)", borderRadius: "0.5rem" }}>
            <p style={{ fontSize: "1rem", fontWeight: 700, color: "var(--color-cream)", margin: 0 }}>{tx.descricao}</p>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.4rem" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>{fmtData(tx.data)}</span>
              <span style={{ fontWeight: 800, color: tx.tipo === "entrada" ? "var(--color-success)" : "var(--color-danger)" }}>
                {tx.tipo === "entrada" ? "+" : "-"}{brl(tx.valor)}
              </span>
            </div>
          </div>

          {erro && <div style={{ background: "rgba(231,76,60,0.1)", border: "1px solid var(--color-danger)", color: "var(--color-danger)", padding: "0.6rem 0.85rem", borderRadius: "0.5rem", fontSize: "0.85rem" }}>{erro}</div>}

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button" onClick={() => setModo("match")} className={modo === "match" ? "btn btn-gold btn-sm" : "btn btn-ghost btn-sm"} disabled={agendamentos.length === 0}>
              Baixar conta existente {agendamentos.length > 0 ? `(${agendamentos.length})` : ""}
            </button>
            <button type="button" onClick={() => setModo("novo")} className={modo === "novo" ? "btn btn-gold btn-sm" : "btn btn-ghost btn-sm"}>
              Criar novo lançamento
            </button>
          </div>

          {modo === "match" ? (
            agendamentos.length === 0 ? (
              <p style={{ fontSize: "0.85rem", color: "var(--color-muted)" }}>Nenhuma conta a {tx.tipo === "entrada" ? "receber" : "pagar"} em aberto com valor compatível.</p>
            ) : (
              <div>
                <label className="form-label">Conta a {tx.tipo === "entrada" ? "receber" : "pagar"}</label>
                <select value={lancamentoId} onChange={e => setLancamentoId(e.target.value)}>
                  {agendamentos.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.descricao} — {a.contatoNome} — {brl(a.valor - a.valorPago)} em aberto (venc. {fmtData(a.dataVencimento)})
                    </option>
                  ))}
                </select>
              </div>
            )
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <label className="form-label">Contato</label>
                <select value={contatoId} onChange={e => setContatoId(e.target.value)} required>
                  <option value="">Selecione...</option>
                  {contatos.filter(c => c.ativo).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label className="form-label">Categoria (opcional)</label>
                  <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)}>
                    <option value="">Sem categoria</option>
                    {categoriasFiltradas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Centro de custo (opcional)</label>
                  <select value={centroCustoId} onChange={e => setCentroCustoId(e.target.value)}>
                    <option value="">Sem centro de custo</option>
                    {centros.filter(c => c.ativo).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">Descrição</label>
                <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)} />
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", marginTop: "0.5rem" }}>
            <button type="button" className="btn btn-ghost" onClick={ignorar} disabled={saving}>Ignorar transação</button>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
              <button type="button" className="btn btn-gold" onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Confirmar"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
