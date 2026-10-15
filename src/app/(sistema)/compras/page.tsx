"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ClipboardList, Copy, Link2, Package, Plus, RefreshCw, ShoppingCart, Undo2, X } from "lucide-react";

interface ItemCadastro {
  id: string; setor: string; nome: string; tipo: string; ordem: number; ativo: boolean; aprovado: boolean;
  ultimoPedidoData: string | null; ultimoPedidoQtd: number | null; pedidos90d: number; abertoDesde: string | null;
}
interface PedidoItem {
  id: string; checklistId: string; itemId: string; quantidade: number | null; observacao: string | null;
  status: "pendente" | "comprado"; dataCompra: string | null; quantidadeComprada: number | null; valor: number | null;
  lancamentoId: string | null; setor: string; nome: string; tipo: string; aprovado: boolean;
}
interface Checklist { id: string; preenchidoPor: string; observacao: string | null; criadoEm: string; itens: PedidoItem[] }
interface Contato { id: string; nome: string }

type Aba = "pedidos" | "itens" | "link";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const quando = (isoLocal: string) => `${isoLocal.slice(8, 10)}/${isoLocal.slice(5, 7)} ${isoLocal.slice(11, 16)}`;
const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

export default function ComprasPage() {
  const [aba, setAba] = useState<Aba>("pedidos");
  const [itens, setItens] = useState<ItemCadastro[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [modalComprar, setModalComprar] = useState(false);
  const [modalVincular, setModalVincular] = useState(false);
  const [msg, setMsg] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch("/api/compras");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Erro ao carregar");
      setItens(j.itens);
      setChecklists(j.checklists);
      setToken(j.token);
      setErro("");
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar compras");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const todosPedidos = useMemo(() => checklists.flatMap((c) => c.itens.map((p) => ({ ...p, por: c.preenchidoPor, criadoEm: c.criadoEm }))), [checklists]);
  const pendentes = todosPedidos.filter((p) => p.status === "pendente");
  const compradosSemVinculo = todosPedidos.filter((p) => p.status === "comprado" && !p.lancamentoId);
  const sugestoes = itens.filter((i) => !i.aprovado && i.ativo);

  const porSetor = <T extends { setor: string }>(lista: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of lista) { if (!m.has(x.setor)) m.set(x.setor, []); m.get(x.setor)!.push(x); }
    return Array.from(m.entries());
  };

  const alternarSel = (id: string) =>
    setSelecionados((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const reabrir = async (ids: string[]) => {
    await fetch("/api/compras/pedidos", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "reabrir", ids }) });
    carregar();
  };

  const abas: { id: Aba; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "pedidos", label: "Pedidos", icon: <ClipboardList size={14} />, badge: pendentes.length },
    { id: "itens", label: "Itens", icon: <Package size={14} />, badge: sugestoes.length },
    { id: "link", label: "Link da recepção", icon: <Link2 size={14} /> },
  ];

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <ShoppingCart size={22} color="var(--color-gold)" />
        <h1 style={{ margin: 0, fontSize: "1.4rem", color: "var(--color-cream)", flex: 1 }}>Compras</h1>
        <button className="btn btn-ghost btn-sm" onClick={carregar}><RefreshCw size={14} /> Atualizar</button>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {abas.map((a) => (
          <button key={a.id} className={`btn btn-sm ${aba === a.id ? "btn-gold" : "btn-ghost"}`} onClick={() => setAba(a.id)}>
            {a.icon} {a.label}{a.badge ? ` (${a.badge})` : ""}
          </button>
        ))}
      </div>

      {msg && <div className="badge badge-success" style={{ marginBottom: "0.75rem" }}>{msg}</div>}
      {erro && <div className="badge badge-danger" style={{ marginBottom: "0.75rem" }}>{erro}</div>}
      {carregando && <div style={{ color: "var(--color-muted)" }}>Carregando…</div>}

      {!carregando && aba === "pedidos" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* KPIs + botão geral de vínculo */}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div className="kpi-card" style={{ flex: "1 1 180px" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>A comprar</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--color-gold)" }}>{pendentes.length}</div>
            </div>
            <div className="kpi-card" style={{ flex: "1 1 180px" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Comprados, sem vínculo</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--color-cream)" }}>{compradosSemVinculo.length}</div>
            </div>
            <div style={{ flex: "1 1 220px", display: "flex", alignItems: "center" }}>
              <button className="btn btn-gold" style={{ width: "100%" }} disabled={compradosSemVinculo.length === 0} onClick={() => setModalVincular(true)}>
                <Link2 size={16} /> Vincular ao Contas a Pagar
              </button>
            </div>
          </div>

          {/* A comprar */}
          <section className="card">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: "1.05rem", color: "var(--color-cream)", flex: 1 }}>A comprar</h2>
              {selecionados.size > 0 && (
                <button className="btn btn-success btn-sm" onClick={() => setModalComprar(true)}>
                  <Check size={14} /> Marcar {selecionados.size} como comprado{selecionados.size > 1 ? "s" : ""}
                </button>
              )}
              {pendentes.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => setSelecionados(selecionados.size === pendentes.length ? new Set() : new Set(pendentes.map((p) => p.id)))}>
                  {selecionados.size === pendentes.length ? "Limpar seleção" : "Selecionar tudo"}
                </button>
              )}
            </div>
            {pendentes.length === 0 && <div style={{ color: "var(--color-muted)" }}>Nada pendente. Quando a recepção enviar a lista, ela aparece aqui.</div>}
            {porSetor(pendentes).map(([setor, lista]) => (
              <div key={setor} style={{ marginBottom: "0.9rem" }}>
                <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-gold-dim)", marginBottom: "0.35rem" }}>{setor}</div>
                {lista.map((p) => (
                  <label key={p.id} style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.45rem 0.25rem", borderBottom: "1px solid var(--color-border)", cursor: "pointer" }}>
                    <input type="checkbox" checked={selecionados.has(p.id)} onChange={() => alternarSel(p.id)} style={{ width: 18, height: 18 }} />
                    <span style={{ flex: 1, color: "var(--color-cream)" }}>
                      {p.nome}{p.quantidade ? <b style={{ color: "var(--color-gold)" }}> ×{p.quantidade}</b> : null}
                      {p.observacao ? <span style={{ color: "var(--color-cream-dim)" }}> — {p.observacao}</span> : null}
                      {!p.aprovado && <span className="badge badge-gold" style={{ marginLeft: 8 }}>novo</span>}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--color-muted)", whiteSpace: "nowrap" }}>{p.por} · {quando(p.criadoEm)}</span>
                  </label>
                ))}
              </div>
            ))}
          </section>

          {/* Comprados, aguardando vínculo */}
          {compradosSemVinculo.length > 0 && (
            <section className="card">
              <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem", color: "var(--color-cream)" }}>Comprados — aguardando vínculo</h2>
              {compradosSemVinculo.map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.4rem 0.25rem", borderBottom: "1px solid var(--color-border)" }}>
                  <span style={{ flex: 1, color: "var(--color-cream)" }}>
                    {p.nome}{p.quantidadeComprada ? ` ×${p.quantidadeComprada}` : ""}
                    <span style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}> · {p.setor}{p.dataCompra ? ` · ${dataBR(p.dataCompra)}` : ""}</span>
                  </span>
                  <span style={{ color: "var(--color-cream-dim)" }}>{p.valor != null ? brl(p.valor) : "—"}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => reabrir([p.id])} title="Voltar para 'a comprar'"><Undo2 size={14} /></button>
                </div>
              ))}
            </section>
          )}

          {/* Histórico de envios */}
          <section className="card">
            <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem", color: "var(--color-cream)" }}>Envios recentes</h2>
            {checklists.length === 0 && <div style={{ color: "var(--color-muted)" }}>Nenhum envio ainda.</div>}
            {checklists.map((c) => {
              const abertos = c.itens.filter((i) => i.status === "pendente").length;
              return (
                <div key={c.id} style={{ padding: "0.45rem 0.25rem", borderBottom: "1px solid var(--color-border)" }}>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                    <b style={{ color: "var(--color-cream)" }}>{c.preenchidoPor}</b>
                    <span style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>{quando(c.criadoEm)}</span>
                    <span className="badge badge-info">{c.itens.length} itens</span>
                    {abertos > 0 ? <span className="badge badge-warning">{abertos} a comprar</span> : <span className="badge badge-success">tudo comprado</span>}
                  </div>
                  {c.observacao && <div style={{ fontSize: "0.85rem", color: "var(--color-cream-dim)", marginTop: 4 }}>“{c.observacao}”</div>}
                </div>
              );
            })}
          </section>
        </div>
      )}

      {!carregando && aba === "itens" && <AbaItens itens={itens} recarregar={carregar} porSetor={porSetor} />}
      {!carregando && aba === "link" && <AbaLink token={token} onToken={setToken} />}

      {modalComprar && (
        <ModalComprar
          pedidos={pendentes.filter((p) => selecionados.has(p.id))}
          onClose={() => setModalComprar(false)}
          onSaved={() => { setModalComprar(false); setSelecionados(new Set()); carregar(); }}
        />
      )}
      {modalVincular && (
        <ModalVincular
          pedidos={compradosSemVinculo}
          onClose={() => setModalVincular(false)}
          onSaved={(texto) => { setModalVincular(false); setMsg(texto); carregar(); setTimeout(() => setMsg(""), 6000); }}
        />
      )}
    </div>
  );
}

// ── Aba Itens ───────────────────────────────────────────────────────────────

function AbaItens({ itens, recarregar, porSetor }: { itens: ItemCadastro[]; recarregar: () => void; porSetor: <T extends { setor: string }>(l: T[]) => [string, T[]][] }) {
  const [setor, setSetor] = useState("");
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("revenda");
  const [erro, setErro] = useState("");
  const setoresExistentes = Array.from(new Set(itens.map((i) => i.setor)));
  const sugestoes = itens.filter((i) => !i.aprovado && i.ativo);
  const cadastrados = itens.filter((i) => i.aprovado);

  const patch = async (id: string, body: object) => {
    await fetch(`/api/compras/itens/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    recarregar();
  };

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    const r = await fetch("/api/compras", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setor, nome, tipo }) });
    if (!r.ok) { setErro((await r.json()).error || "Erro ao cadastrar"); return; }
    setNome("");
    recarregar();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {sugestoes.length > 0 && (
        <section className="card">
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.05rem", color: "var(--color-cream)" }}>Sugestões da recepção ({sugestoes.length})</h2>
          <div style={{ fontSize: "0.85rem", color: "var(--color-muted)", marginBottom: "0.5rem" }}>Itens digitados em “outro item”. Aprove para entrarem na lista fixa; recusar apenas esconde.</div>
          {sugestoes.map((i) => (
            <div key={i.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0", borderBottom: "1px solid var(--color-border)" }}>
              <span style={{ flex: 1, color: "var(--color-cream)" }}>{i.nome} <span style={{ color: "var(--color-muted)" }}>· {i.setor}</span></span>
              <button className="btn btn-success btn-sm" onClick={() => patch(i.id, { aprovado: true })}><Check size={14} /> Aprovar</button>
              <button className="btn btn-danger btn-sm" onClick={() => patch(i.id, { ativo: false, aprovado: true })}><X size={14} /> Recusar</button>
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem", color: "var(--color-cream)" }}>Novo item</h2>
        <form onSubmit={criar} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <input list="setores" value={setor} onChange={(e) => setSetor(e.target.value)} placeholder="Setor (ex.: WS)" required style={inp} />
          <datalist id="setores">{setoresExistentes.map((s) => <option key={s} value={s} />)}</datalist>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do item" required style={{ ...inp, flex: 1, minWidth: 180 }} />
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={inp}>
            <option value="revenda">Revenda</option>
            <option value="consumo">Consumo</option>
          </select>
          <button className="btn btn-gold" type="submit"><Plus size={16} /> Cadastrar</button>
        </form>
        {erro && <div style={{ color: "var(--color-danger)", marginTop: 6 }}>{erro}</div>}
      </section>

      {porSetor(cadastrados).map(([s, lista]) => (
        <section key={s} className="card">
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem", color: "var(--color-gold)" }}>{s}</h2>
          {lista.map((i) => (
            <div key={i.id} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.4rem 0", borderBottom: "1px solid var(--color-border)", opacity: i.ativo ? 1 : 0.5, flexWrap: "wrap" }}>
              <span style={{ flex: "1 1 200px", color: "var(--color-cream)" }}>
                {i.nome}
                <span className={`badge ${i.tipo === "consumo" ? "badge-info" : "badge-gold"}`} style={{ marginLeft: 8 }}>{i.tipo === "consumo" ? "consumo" : "revenda"}</span>
              </span>
              <span style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>
                {i.ultimoPedidoData ? `último: ${dataBR(i.ultimoPedidoData)}${i.ultimoPedidoQtd ? ` · ${i.ultimoPedidoQtd} un` : ""}` : "nunca pedido"} · {i.pedidos90d}× em 90 dias
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => patch(i.id, { ativo: !i.ativo })}>{i.ativo ? "Desativar" : "Reativar"}</button>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

const inp: React.CSSProperties = {
  padding: "0.55rem 0.7rem", borderRadius: 8, border: "1px solid var(--color-border-light)",
  background: "var(--color-surface-2)", color: "var(--color-cream)", fontSize: "0.9rem",
};

// ── Aba Link ────────────────────────────────────────────────────────────────

function AbaLink({ token, onToken }: { token: string | null; onToken: (t: string) => void }) {
  const [copiado, setCopiado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState("");
  const url = token && typeof window !== "undefined" ? `${window.location.origin}/compras/lista/${token}` : "";

  const [destino, setDestino] = useState("");
  const [destinoMsg, setDestinoMsg] = useState("");
  const formatarNumero = (d: string) => (d.length === 13 ? `+${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 9)}-${d.slice(9)}` : d ? `+${d}` : "");
  useEffect(() => {
    fetch("/api/compras/config").then((r) => (r.ok ? r.json() : null)).then((j) => j && setDestino(formatarNumero(j.whatsappDestino ?? "")));
  }, []);
  const salvarDestino = async () => {
    setDestinoMsg("");
    const r = await fetch("/api/compras/config", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ whatsappDestino: destino }) });
    const j = await r.json();
    if (!r.ok) { setDestinoMsg(j.error || "Erro ao salvar"); return; }
    setDestino(formatarNumero(j.whatsappDestino));
    setDestinoMsg("Salvo.");
  };

  const copiar = async () => {
    try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sem clipboard */ }
  };
  const trocar = async () => {
    setErro("");
    const r = await fetch("/api/compras/token", { method: "POST" });
    const j = await r.json();
    if (!r.ok) { setErro(j.error || "Erro ao trocar"); return; }
    onToken(j.token);
    setConfirmando(false);
  };

  return (
    <section className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <h2 style={{ margin: 0, fontSize: "1.05rem", color: "var(--color-cream)" }}>Formulário da recepção</h2>
      <div style={{ color: "var(--color-cream-dim)", fontSize: "0.9rem" }}>
        Este link abre no celular sem login. Salve nos favoritos do aparelho da recepção. Quem tiver o link consegue enviar uma lista (mas não vê nenhum dado financeiro).
      </div>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} style={{ ...inp, flex: 1, minWidth: 240 }} />
        <button className="btn btn-gold" onClick={copiar}><Copy size={16} /> {copiado ? "Copiado!" : "Copiar"}</button>
        <a className="btn btn-ghost" href={url} target="_blank" rel="noreferrer">Abrir</a>
      </div>
      <div>
        <button className="btn btn-ghost btn-sm" onClick={() => setConfirmando(true)}><RefreshCw size={14} /> Trocar link</button>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid var(--color-border)", width: "100%" }} />
      <h2 style={{ margin: 0, fontSize: "1.05rem", color: "var(--color-cream)" }}>Aviso por WhatsApp</h2>
      <div style={{ color: "var(--color-cream-dim)", fontSize: "0.9rem" }}>
        Quando a recepção envia a lista, a mensagem chega neste número. Deixe em branco para usar o grupo de avisos.
      </div>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <input value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="+55 12 98834-0011" inputMode="tel" style={{ ...inp, minWidth: 220 }} />
        <button className="btn btn-gold btn-sm" onClick={salvarDestino}>Salvar</button>
        {destinoMsg && <span style={{ fontSize: "0.85rem", color: destinoMsg.startsWith("Salvo") ? "var(--color-success)" : "var(--color-danger)" }}>{destinoMsg}</span>}
      </div>
      {erro && <div style={{ color: "var(--color-danger)" }}>{erro}</div>}

      {confirmando && (
        <div className="modal-overlay" onClick={() => setConfirmando(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3 style={{ marginTop: 0, color: "var(--color-cream)" }}>Trocar o link?</h3>
            <p style={{ color: "var(--color-cream-dim)" }}>O link atual para de funcionar e a recepção precisará do novo.</p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setConfirmando(false)}>Cancelar</button>
              <button className="btn btn-gold" onClick={trocar}>Trocar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Modal: marcar como comprado ─────────────────────────────────────────────

function ModalComprar({ pedidos, onClose, onSaved }: { pedidos: (PedidoItem & { por: string })[]; onClose: () => void; onSaved: () => void }) {
  const [data, setData] = useState(hoje());
  const [valores, setValores] = useState<Record<string, string>>({});
  const [qtds, setQtds] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  const salvar = async () => {
    setSaving(true);
    setErro("");
    try {
      const r = await fetch("/api/compras/pedidos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "comprar",
          dataCompra: data,
          itens: pedidos.map((p) => ({
            id: p.id,
            quantidadeComprada: qtds[p.id] ? Number(qtds[p.id]) : p.quantidade,
            valor: valores[p.id] ? Number(valores[p.id].replace(",", ".")) : null,
          })),
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      onSaved();
    } catch (e: any) {
      setErro(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, width: "100%", maxHeight: "85vh", overflowY: "auto" }}>
        <h3 style={{ marginTop: 0, color: "var(--color-cream)" }}>Marcar como comprado</h3>
        <label style={{ display: "block", fontSize: "0.8rem", color: "var(--color-muted)", marginBottom: 4 }}>Data da compra</label>
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ ...inp, marginBottom: "0.75rem" }} />
        <div style={{ fontSize: "0.8rem", color: "var(--color-muted)", marginBottom: "0.4rem" }}>Valor e quantidade por item são opcionais — você pode informar o total ao vincular ao Contas a Pagar.</div>
        {pedidos.map((p) => (
          <div key={p.id} style={{ display: "flex", gap: "0.5rem", alignItems: "center", padding: "0.35rem 0", borderBottom: "1px solid var(--color-border)" }}>
            <span style={{ flex: 1, color: "var(--color-cream)" }}>{p.nome}<span style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}> · {p.setor}</span></span>
            <input placeholder={p.quantidade ? String(p.quantidade) : "qtd"} value={qtds[p.id] ?? ""} onChange={(e) => setQtds({ ...qtds, [p.id]: e.target.value })} inputMode="numeric" style={{ ...inp, width: 64 }} />
            <input placeholder="R$" value={valores[p.id] ?? ""} onChange={(e) => setValores({ ...valores, [p.id]: e.target.value })} inputMode="decimal" style={{ ...inp, width: 90 }} />
          </div>
        ))}
        {erro && <div style={{ color: "var(--color-danger)", marginTop: 8 }}>{erro}</div>}
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold" onClick={salvar} disabled={saving}>{saving ? "Salvando…" : "Confirmar"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Vincular ao Contas a Pagar (decisão Sim/Não do dono) ────────────

function ModalVincular({ pedidos, onClose, onSaved }: { pedidos: (PedidoItem & { por: string })[]; onClose: () => void; onSaved: (texto: string) => void }) {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [contatoId, setContatoId] = useState("");
  const [venc, setVenc] = useState(hoje());
  const somaItens = pedidos.reduce((a, p) => a + (p.valor ?? 0), 0);
  const [valor, setValor] = useState(somaItens > 0 ? String(somaItens.toFixed(2)) : "");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    fetch("/api/financeiro/contatos").then((r) => (r.ok ? r.json() : [])).then((l) => setContatos(Array.isArray(l) ? l : []));
  }, []);

  const totalNum = Number(valor.replace(",", "."));
  const nRevenda = pedidos.filter((p) => p.tipo !== "consumo").length;
  const nConsumo = pedidos.length - nRevenda;

  const vincular = async () => {
    setErro("");
    if (!contatoId) { setErro("Escolha o fornecedor."); return; }
    if (!(totalNum > 0)) { setErro("Informe o valor total da compra."); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/compras/vincular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: pedidos.map((p) => p.id), contatoId, dataVencimento: venc, valor: totalNum }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      onSaved(`Vinculado: ${j.itens} itens viraram uma conta a pagar de ${brl(j.valor)}.`);
    } catch (e: any) {
      setErro(e.message || "Erro ao vincular");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, width: "100%" }}>
        <h3 style={{ marginTop: 0, color: "var(--color-cream)" }}>Vincular ao Contas a Pagar?</h3>
        <p style={{ color: "var(--color-cream-dim)", marginTop: 0 }}>
          {pedidos.length} {pedidos.length === 1 ? "item comprado vira" : "itens comprados viram"} <b>uma</b> conta a pagar, rateada entre
          {" "}Compra para Revenda ({nRevenda}) e Uso e Consumo ({nConsumo}). Nada é lançado sem o seu “Sim”.
        </p>

        <label style={{ display: "block", fontSize: "0.8rem", color: "var(--color-muted)", marginBottom: 4 }}>Fornecedor</label>
        <select value={contatoId} onChange={(e) => setContatoId(e.target.value)} style={{ ...inp, width: "100%", marginBottom: "0.75rem" }}>
          <option value="">Selecione…</option>
          {contatos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--color-muted)", marginBottom: 4 }}>Valor total (R$)</label>
            <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="0,00" style={{ ...inp, width: "100%" }} />
            {somaItens > 0 && <div style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginTop: 2 }}>Soma dos itens: {brl(somaItens)}</div>}
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--color-muted)", marginBottom: 4 }}>Vencimento</label>
            <input type="date" value={venc} onChange={(e) => setVenc(e.target.value)} style={{ ...inp, width: "100%" }} />
          </div>
        </div>

        {erro && <div style={{ color: "var(--color-danger)", marginTop: 8 }}>{erro}</div>}
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem" }}>
          <button className="btn btn-ghost" onClick={onClose}>Não</button>
          <button className="btn btn-gold" onClick={vincular} disabled={saving}>{saving ? "Vinculando…" : "Sim, vincular"}</button>
        </div>
      </div>
    </div>
  );
}
