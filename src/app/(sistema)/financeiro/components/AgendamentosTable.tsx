"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Check, Search, Trash2, Pencil, Repeat, ChevronDown, ChevronUp, Square, CheckSquare, Link2 } from "lucide-react";
import type { Agendamento, TipoAgendamento, StatusAgendamento, CategoriaFinanceira, CentroCusto, ContaBancaria, Contato, BucketAgendamento } from "@/lib/financeiro-data";
import { statusAgendamento, bucketAgendamento, diasEmAtraso, BUCKET_ORDEM, BUCKET_LABELS, STATUS_LABELS, STATUS_COLORS } from "@/lib/financeiro-data";
import AgendamentoForm from "./AgendamentoForm";
import BaixaModal from "./BaixaModal";
import BaixaEmLoteModal from "./BaixaEmLoteModal";
import CategorizarEmLoteModal from "./CategorizarEmLoteModal";
import CategoriaCombobox from "./CategoriaCombobox";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d: string | null | undefined) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";

type StatusFiltroUI = "naoQuitados" | StatusAgendamento | "todos";

interface MatchInfo {
  agendamentoId: string;
  transacaoId: string;
  transacaoValor: number;
  transacaoData: string;
  transacaoDescricao: string | null;
  transacaoDescricaoComplementar: string | null;
}

export default function AgendamentosTable() {
  const [tipo, setTipo] = useState<TipoAgendamento>("pagar");
  // "Não quitados" é o padrão — exclui só o que já foi 100% pago (o grosso do histórico
  // importado do Nibo), sem esconder nada que ainda precisa de atenção.
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltroUI>("naoQuitados");
  const [busca, setBusca] = useState("");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [categoriaId, setCategoriaId] = useState("");
  const [centroCustoId, setCentroCustoId] = useState("");
  const [contaBancariaId, setContaBancariaId] = useState("");
  const [contatoId, setContatoId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [matches, setMatches] = useState<Map<string, MatchInfo>>(new Map());
  const [confirmandoMatch, setConfirmandoMatch] = useState<string | null>(null);
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>([]);
  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Agendamento | null>(null);
  const [baixaAlvo, setBaixaAlvo] = useState<Agendamento | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [showBaixaLote, setShowBaixaLote] = useState(false);
  const [showCategorizarLote, setShowCategorizarLote] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/financeiro/categorias").then(r => r.ok ? r.json() : []),
      fetch("/api/financeiro/centros-custo").then(r => r.ok ? r.json() : []),
      fetch("/api/financeiro/contas-bancarias").then(r => r.ok ? r.json() : []),
      fetch("/api/financeiro/contatos").then(r => r.ok ? r.json() : []),
    ]).then(([cat, cc, cb, ct]) => { setCategorias(cat); setCentros(cc); setContas(cb); setContatos(ct); });
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tipo });
      // Qualquer status que não seja "todos"/"pago" já implica só o que ainda não foi
      // totalmente quitado — deixa o corte pesado (a maioria das linhas históricas) pro
      // servidor, em vez de buscar tudo e filtrar no client.
      if (statusFiltro !== "todos" && statusFiltro !== "pago") params.set("apenasAbertos", "true");
      if (categoriaId) params.set("categoriaId", categoriaId);
      if (centroCustoId) params.set("centroCustoId", centroCustoId);
      if (contaBancariaId) params.set("contaBancariaId", contaBancariaId);
      if (contatoId) params.set("contatoId", contatoId);
      if (dataInicio) params.set("dataInicio", dataInicio);
      if (dataFim) params.set("dataFim", dataFim);
      const [res, resMatches] = await Promise.all([
        fetch(`/api/financeiro/agendamentos?${params.toString()}`),
        fetch(`/api/financeiro/agendamentos/matches?tipo=${tipo}`),
      ]);
      setAgendamentos(res.ok ? await res.json() : []);
      const matchesArr: MatchInfo[] = resMatches.ok ? await resMatches.json() : [];
      setMatches(new Map(matchesArr.map(m => [m.agendamentoId, m])));
    } catch (err) {
      console.error("Erro ao carregar agendamentos:", err);
    } finally {
      setLoading(false);
    }
  }, [tipo, statusFiltro, categoriaId, centroCustoId, contaBancariaId, contatoId, dataInicio, dataFim]);

  useEffect(() => { carregar(); }, [carregar]);

  // Confirma o match sugerido: reaproveita a mesma rota que a tela de Conciliação Bancária
  // usa pra vincular manualmente uma transação a um agendamento existente — nunca dá baixa
  // sozinho sem esse clique.
  const confirmarMatch = async (m: MatchInfo) => {
    if (!confirm(`Vincular a transação de ${brl(m.transacaoValor)} (${fmtData(m.transacaoData)}) a este agendamento e dar baixa?`)) return;
    setConfirmandoMatch(m.agendamentoId);
    try {
      const res = await fetch(`/api/financeiro/transacoes-bancarias/${m.transacaoId}/conciliar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lancamentoId: m.agendamentoId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      carregar();
    } catch (err: any) {
      alert(err.message || "Erro ao confirmar match");
    } finally {
      setConfirmandoMatch(null);
    }
  };
  // Trocar de Pagar/Receber troca o universo inteiro de linhas — uma seleção antiga não
  // faz mais sentido nesse contexto novo.
  useEffect(() => { setSelecionados(new Set()); }, [tipo]);

  const excluir = async (id: string) => {
    if (!confirm("Excluir este agendamento? (só é possível se não tiver nenhuma baixa registrada)")) return;
    const res = await fetch(`/api/financeiro/agendamentos/${id}`, { method: "DELETE" });
    if (!res.ok) alert((await res.json()).error || "Erro ao excluir");
    carregar();
  };

  const abrirNovo = () => { setEditando(null); setShowForm(true); };
  const abrirEdicao = (a: Agendamento) => { setEditando(a); setShowForm(true); };
  const fecharForm = () => { setShowForm(false); setEditando(null); };

  const filtrados = useMemo(() => {
    return agendamentos
      .map(a => ({ ...a, status: statusAgendamento(a) }))
      .filter(a => {
        if (statusFiltro === "todos") return true;
        if (statusFiltro === "naoQuitados") return a.status !== "pago";
        return a.status === statusFiltro;
      })
      .filter(a => !busca || a.descricao.toLowerCase().includes(busca.toLowerCase()) || a.contatoNome?.toLowerCase().includes(busca.toLowerCase()));
  }, [agendamentos, statusFiltro, busca]);

  const grupos = useMemo(() => {
    const mapa = new Map<BucketAgendamento, typeof filtrados>();
    for (const b of BUCKET_ORDEM) mapa.set(b, []);
    for (const a of filtrados) mapa.get(bucketAgendamento(a))!.push(a);
    return BUCKET_ORDEM.map(bucket => ({ bucket, itens: mapa.get(bucket)! })).filter(g => g.itens.length > 0);
  }, [filtrados]);

  const totalAberto = filtrados.filter(a => a.status !== "pago").reduce((acc, a) => acc + (a.valor - a.valorPago), 0);

  const toggleSelecionado = (id: string) => setSelecionados(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const todosVisiveisSelecionados = filtrados.length > 0 && filtrados.every(a => selecionados.has(a.id));
  const toggleTodosVisiveis = () => setSelecionados(prev => {
    if (todosVisiveisSelecionados) {
      const next = new Set(prev);
      filtrados.forEach(a => next.delete(a.id));
      return next;
    }
    const next = new Set(prev);
    filtrados.forEach(a => next.add(a.id));
    return next;
  });

  const agendamentosSelecionados = agendamentos.filter(a => selecionados.has(a.id));
  const selecionadosComSaldo = agendamentosSelecionados.filter(a => a.valor - a.valorPago > 0.009);

  const excluirSelecionados = async () => {
    if (!confirm(`Excluir ${selecionados.size} agendamento(s) selecionado(s)? (só os sem baixa registrada serão excluídos)`)) return;
    let ok = 0, falhas: string[] = [];
    for (const a of agendamentosSelecionados) {
      const res = await fetch(`/api/financeiro/agendamentos/${a.id}`, { method: "DELETE" });
      if (res.ok) ok++; else falhas.push(`${a.descricao}: ${(await res.json()).error || "erro"}`);
    }
    setSelecionados(new Set());
    carregar();
    if (falhas.length > 0) alert(`${ok} excluído(s). ${falhas.length} não puderam ser excluídos:\n${falhas.join("\n")}`);
  };

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
        <button className="btn btn-gold" onClick={abrirNovo}><Plus size={16} /> Novo Agendamento</button>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={14} color="var(--color-muted)" style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)" }} />
          <input placeholder="Buscar descrição ou contato..." value={busca} onChange={e => setBusca(e.target.value)} style={{ paddingLeft: "2.25rem" }} />
        </div>
        <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value as StatusFiltroUI)} style={{ width: "auto" }}>
          <option value="naoQuitados">Não quitados</option>
          <option value="vencido">Vencido</option>
          <option value="aberto">Em aberto</option>
          <option value="parcial">Parcialmente pago</option>
          <option value="pago">Quitado</option>
          <option value="todos">Todos os status</option>
        </select>
        <button onClick={() => setFiltrosAbertos(v => !v)} className="btn btn-ghost btn-sm">
          Mais filtros {filtrosAbertos ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        <span style={{ fontSize: "0.85rem", color: "var(--color-muted)" }}>
          {filtrados.length} lançamento{filtrados.length !== 1 ? "s" : ""} · em aberto: <strong style={{ color: "var(--color-gold)" }}>{brl(totalAberto)}</strong>
        </span>
      </div>

      {filtrosAbertos && (
        <div className="card" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem", padding: "1rem" }}>
          <div>
            <label className="form-label">Categoria</label>
            <CategoriaCombobox categorias={categorias} tipo={tipo === "pagar" ? "saida" : "entrada"} value={categoriaId} onChange={setCategoriaId} placeholder="Todas" />
          </div>
          <div>
            <label className="form-label">Centro de custo</label>
            <select value={centroCustoId} onChange={e => setCentroCustoId(e.target.value)}>
              <option value="">Todos</option>
              {centros.filter(c => c.ativo).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Conta bancária</label>
            <select value={contaBancariaId} onChange={e => setContaBancariaId(e.target.value)}>
              <option value="">Todas</option>
              {contas.filter(c => c.ativa).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Contato</label>
            <select value={contatoId} onChange={e => setContatoId(e.target.value)}>
              <option value="">Todos</option>
              {contatos.filter(c => c.ativo).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Vencimento de</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Vencimento até</label>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
          </div>
        </div>
      )}

      {selecionados.size > 0 && (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", padding: "0.75rem 1rem", border: "1px solid var(--color-gold)" }}>
          <strong style={{ fontSize: "0.85rem", color: "var(--color-gold)" }}>{selecionados.size} selecionado{selecionados.size === 1 ? "" : "s"}</strong>
          {selecionadosComSaldo.length > 0 && (
            <button className="btn btn-gold btn-sm" onClick={() => setShowBaixaLote(true)}>Dar baixa em lote</button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setShowCategorizarLote(true)}>Categorizar em lote</button>
          <button className="btn btn-ghost btn-sm" onClick={excluirSelecionados} style={{ color: "var(--color-danger)" }}>Excluir selecionados</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelecionados(new Set())}>Limpar seleção</button>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <button type="button" onClick={toggleTodosVisiveis} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", color: "var(--color-muted)" }} title="Selecionar todos os visíveis">
                  {todosVisiveisSelecionados ? <CheckSquare size={16} color="var(--color-gold)" /> : <Square size={16} />}
                </button>
              </th>
              <th>Vencimento</th><th>{tipo === "pagar" ? "Fornecedor/Funcionário/Sócio" : "Cliente"}</th>
              <th>Descrição</th><th>Categoria</th><th>Status</th>
              <th style={{ textAlign: "right" }}>Valor</th><th style={{ textAlign: "right" }}>Pago</th><th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ textAlign: "center", padding: "2rem", color: "var(--color-muted)" }}>Carregando...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: "center", padding: "3rem", color: "var(--color-muted)" }}>Nenhum agendamento encontrado.</td></tr>
            ) : grupos.map(({ bucket, itens }) => (
              <FragmentGrupo key={bucket} bucket={bucket} itens={itens} tipo={tipo}
                selecionados={selecionados} toggleSelecionado={toggleSelecionado}
                onBaixa={setBaixaAlvo} onEditar={abrirEdicao} onExcluir={excluir}
                matches={matches} confirmandoMatch={confirmandoMatch} onConfirmarMatch={confirmarMatch} />
            ))}
          </tbody>
        </table>
      </div>

      <AgendamentoForm isOpen={showForm} onClose={fecharForm} onSaved={carregar} tipoInicial={tipo} editando={editando} />
      <BaixaModal agendamento={baixaAlvo} onClose={() => setBaixaAlvo(null)} onSaved={carregar} />
      {showBaixaLote && (
        <BaixaEmLoteModal agendamentos={selecionadosComSaldo} onClose={() => setShowBaixaLote(false)} onSaved={() => { setSelecionados(new Set()); carregar(); }} />
      )}
      {showCategorizarLote && (
        <CategorizarEmLoteModal agendamentos={agendamentosSelecionados} categorias={categorias} onClose={() => setShowCategorizarLote(false)} onSaved={() => { setSelecionados(new Set()); carregar(); }} />
      )}
    </div>
  );
}

// ── Um grupo (balde de vencimento) inteiro: cabeçalho com contagem/subtotal + as linhas.
// "Vencidos" ganha destaque vermelho — é o único grupo que representa urgência de verdade;
// os outros são só organização.
function FragmentGrupo({ bucket, itens, tipo, selecionados, toggleSelecionado, onBaixa, onEditar, onExcluir, matches, confirmandoMatch, onConfirmarMatch }: {
  bucket: BucketAgendamento;
  itens: (Agendamento & { status: StatusAgendamento })[];
  tipo: TipoAgendamento;
  selecionados: Set<string>;
  toggleSelecionado: (id: string) => void;
  onBaixa: (a: Agendamento) => void;
  onEditar: (a: Agendamento) => void;
  onExcluir: (id: string) => void;
  matches: Map<string, MatchInfo>;
  confirmandoMatch: string | null;
  onConfirmarMatch: (m: MatchInfo) => void;
}) {
  const vencidos = bucket === "vencido";
  const subtotal = itens.reduce((acc, a) => acc + (a.valor - a.valorPago), 0);
  return (
    <>
      <tr>
        <td colSpan={9} style={{
          padding: "0.5rem 1rem", fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em",
          color: vencidos ? "var(--color-danger)" : "var(--color-muted)",
          background: vencidos ? "rgba(231,76,60,0.08)" : "var(--color-surface-2)",
          borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)",
        }}>
          {BUCKET_LABELS[bucket]} ({itens.length}) {bucket !== "quitado" && <span style={{ fontWeight: 600, textTransform: "none", letterSpacing: 0 }}> · {brl(subtotal)}</span>}
        </td>
      </tr>
      {itens.map(a => (
        <tr key={a.id}>
          <td>
            <button type="button" onClick={() => toggleSelecionado(a.id)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", color: "var(--color-muted)" }}>
              {selecionados.has(a.id) ? <CheckSquare size={16} color="var(--color-gold)" /> : <Square size={16} />}
            </button>
          </td>
          <td style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>
            {fmtData(a.dataVencimento)}
            {bucket === "vencido" && a.dataVencimento && (
              <div style={{ color: "var(--color-danger)", fontSize: "0.7rem", fontWeight: 700 }}>{diasEmAtraso(a.dataVencimento)}d em atraso</div>
            )}
          </td>
          <td style={{ fontWeight: 500 }}>{a.contatoNome}</td>
          <td style={{ fontSize: "0.85rem", color: "var(--color-cream-dim)" }}>
            {a.descricao}
            {a.serieId && (
              <span
                title={a.serieParcelaTotal ? `Parcela ${a.parcelaNumero} de ${a.serieParcelaTotal}` : `Recorrência — ocorrência ${a.parcelaNumero}`}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem", marginLeft: "0.5rem", fontSize: "0.7rem", color: "var(--color-gold)", border: "1px solid var(--color-gold)", borderRadius: "999px", padding: "0.05rem 0.45rem" }}
              >
                <Repeat size={10} />
                {a.serieParcelaTotal ? `${a.parcelaNumero}/${a.serieParcelaTotal}` : "recorrente"}
              </span>
            )}
          </td>
          <td style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>{a.categoriaNome || "—"}</td>
          <td>
            <span className="badge" style={{ background: `${STATUS_COLORS[a.status]}22`, color: STATUS_COLORS[a.status], border: `1px solid ${STATUS_COLORS[a.status]}55` }}>
              {STATUS_LABELS[a.status]}
            </span>
            {matches.has(a.id) && (() => {
              const m = matches.get(a.id)!;
              return (
                <button
                  type="button"
                  onClick={() => onConfirmarMatch(m)}
                  disabled={confirmandoMatch === a.id}
                  title={`Saída do banco compatível: ${brl(m.transacaoValor)} em ${fmtData(m.transacaoData)} — ${m.transacaoDescricaoComplementar || m.transacaoDescricao || "sem descrição"}. Clique pra vincular e dar baixa.`}
                  className="badge"
                  style={{ marginLeft: "0.4rem", background: "rgba(46,204,113,0.12)", color: "var(--color-success)", border: "1px solid var(--color-success)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.2rem" }}
                >
                  <Link2 size={10} /> {confirmandoMatch === a.id ? "..." : "Match"}
                </button>
              );
            })()}
          </td>
          <td style={{ textAlign: "right", fontWeight: 700 }}>{brl(a.valor)}</td>
          <td style={{ textAlign: "right", color: "var(--color-muted)" }}>{brl(a.valorPago)}</td>
          <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
            {a.status !== "pago" && (
              <button onClick={() => onBaixa(a)} title="Registrar pagamento/recebimento" style={{ background: "none", border: "none", color: "var(--color-success)", cursor: "pointer", marginRight: "0.5rem" }}>
                <Check size={16} />
              </button>
            )}
            <button onClick={() => onEditar(a)} title="Editar" style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer", marginRight: "0.5rem" }}>
              <Pencil size={14} />
            </button>
            {a.valorPago === 0 && (
              <button onClick={() => onExcluir(a.id)} title="Excluir" style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer" }}>
                <Trash2 size={14} />
              </button>
            )}
          </td>
        </tr>
      ))}
    </>
  );
}
