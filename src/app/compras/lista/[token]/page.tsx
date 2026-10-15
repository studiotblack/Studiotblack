"use client";

import { use, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Minus, Plus, Send, ShoppingCart } from "lucide-react";

// Checkpoint semanal da recepção — página PÚBLICA (sem login), pensada pro celular.
// O acesso é pelo token na URL; o rascunho fica só no aparelho (localStorage).

interface Item {
  id: string;
  setor: string;
  nome: string;
  tipo: string;
  ultimoPedidoData: string | null;
  ultimoPedidoQtd: number | null;
  pedidos90d: number;
  abertoDesde: string | null;
}
interface Marcado { quantidade: number | null; observacao: string; forcar?: boolean }
interface Outro { setor: string; nome: string; quantidade: number | null }

const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export default function ChecklistPublico({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const chaveRascunho = `compras-rascunho-${token.slice(0, 12)}`;

  const [itens, setItens] = useState<Item[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState("");
  const [marcados, setMarcados] = useState<Record<string, Marcado>>({});
  const [outros, setOutros] = useState<Outro[]>([]);
  const [nome, setNome] = useState("");
  const [observacao, setObservacao] = useState("");
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [novoOutro, setNovoOutro] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState("");
  const [enviado, setEnviado] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/compras/publico/${token}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Erro ao carregar");
        setItens(j.itens);
      })
      .catch((e) => setErroCarga(e.message || "Erro ao carregar a lista."))
      .finally(() => setCarregando(false));

    try {
      const salvo = JSON.parse(localStorage.getItem(chaveRascunho) || "null");
      if (salvo) {
        setMarcados(salvo.marcados ?? {});
        setOutros(salvo.outros ?? []);
        setNome(salvo.nome ?? "");
        setObservacao(salvo.observacao ?? "");
      } else {
        setNome(localStorage.getItem("compras-nome") ?? "");
      }
    } catch { /* sem localStorage: segue sem rascunho */ }
  }, [token, chaveRascunho]);

  useEffect(() => {
    try {
      localStorage.setItem(chaveRascunho, JSON.stringify({ marcados, outros, nome, observacao }));
      if (nome) localStorage.setItem("compras-nome", nome);
    } catch { /* ignora */ }
  }, [marcados, outros, nome, observacao, chaveRascunho]);

  const setores = useMemo(() => {
    const ordem: string[] = [];
    const mapa = new Map<string, Item[]>();
    for (const it of itens) {
      if (!mapa.has(it.setor)) { mapa.set(it.setor, []); ordem.push(it.setor); }
      mapa.get(it.setor)!.push(it);
    }
    return ordem.map((s) => ({ setor: s, itens: mapa.get(s)! }));
  }, [itens]);

  const total = Object.keys(marcados).length + outros.length;

  const alternar = (it: Item) => {
    setMarcados((m) => {
      const n = { ...m };
      if (n[it.id]) delete n[it.id];
      else n[it.id] = { quantidade: null, observacao: "" };
      return n;
    });
  };
  const ajustarQtd = (id: string, delta: number) => {
    setMarcados((m) => {
      const atual = m[id]?.quantidade ?? 0;
      const novo = Math.max(0, atual + delta);
      return { ...m, [id]: { ...m[id], quantidade: novo === 0 ? null : novo } };
    });
  };
  const adicionarOutro = (setor: string) => {
    const t = (novoOutro[setor] ?? "").trim();
    if (!t) return;
    setOutros((o) => [...o, { setor, nome: t, quantidade: null }]);
    setNovoOutro((n) => ({ ...n, [setor]: "" }));
  };

  const enviar = async () => {
    setErroEnvio("");
    if (!nome.trim()) { setErroEnvio("Escreva o seu nome antes de enviar."); return; }
    if (total === 0) { setErroEnvio("Marque ao menos um item."); return; }
    setEnviando(true);
    try {
      const res = await fetch(`/api/compras/publico/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          observacao,
          itens: Object.entries(marcados).map(([itemId, v]) => ({ itemId, quantidade: v.quantidade, observacao: v.observacao })),
          outros,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Erro ao enviar");
      try { localStorage.removeItem(chaveRascunho); } catch { /* ignora */ }
      setEnviado(j.total);
    } catch (e: any) {
      setErroEnvio(e.message || "Erro ao enviar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  };

  const wrap: React.CSSProperties = { maxWidth: 560, margin: "0 auto", padding: "1rem 1rem 7rem" };

  if (carregando) return <div style={{ ...wrap, color: "var(--color-muted)" }}>Carregando a lista…</div>;
  if (erroCarga) {
    return (
      <div style={wrap}>
        <h1 style={{ color: "var(--color-cream)", fontSize: "1.25rem" }}>Link indisponível</h1>
        <p style={{ color: "var(--color-muted)" }}>{erroCarga} Peça um link novo ao responsável.</p>
      </div>
    );
  }

  if (enviado !== null) {
    return (
      <div style={{ ...wrap, textAlign: "center", paddingTop: "4rem" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--color-success-dim)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--color-success)" }}>
          <Check size={36} />
        </div>
        <h1 style={{ color: "var(--color-cream)", fontSize: "1.4rem", marginTop: "1rem" }}>Lista enviada!</h1>
        <p style={{ color: "var(--color-cream-dim)" }}>{enviado} {enviado === 1 ? "item" : "itens"} chegaram para a compra. Obrigado.</p>
        <button className="btn btn-ghost" style={{ marginTop: "1.5rem" }} onClick={() => location.reload()}>Fazer outra lista</button>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <header style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#d4af8c,#a88660)", display: "flex", alignItems: "center", justifyContent: "center", color: "#1a0f10" }}>
          <ShoppingCart size={18} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.15rem", color: "var(--color-cream)" }}>Lista de compras da semana</h1>
          <div style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>Studio T'Black · marque o que está faltando</div>
        </div>
      </header>

      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Seu nome"
        style={{ width: "100%", padding: "0.75rem", fontSize: "1rem", borderRadius: 10, border: "1px solid var(--color-border-light)", background: "var(--color-surface-2)", color: "var(--color-cream)", marginBottom: "1rem" }}
      />

      {setores.map(({ setor, itens: lista }) => {
        const aberto = abertos[setor] ?? false;
        const marcadosNoSetor = lista.filter((i) => marcados[i.id]).length + outros.filter((o) => o.setor === setor).length;
        return (
          <section key={setor} style={{ border: "1px solid var(--color-border)", borderRadius: 14, background: "var(--color-surface)", marginBottom: "0.75rem", overflow: "hidden" }}>
            <button
              onClick={() => setAbertos((a) => ({ ...a, [setor]: !aberto }))}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.9rem 1rem", background: "transparent", border: "none", color: "var(--color-cream)", fontSize: "1.05rem", fontWeight: 600, cursor: "pointer" }}
            >
              <span style={{ flex: 1, textAlign: "left" }}>{setor}</span>
              {marcadosNoSetor > 0 && <span className="badge badge-gold">{marcadosNoSetor} faltando</span>}
              {aberto ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {aberto && (
              <div style={{ padding: "0 0.75rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {lista.map((it) => {
                  const m = marcados[it.id];
                  const jaPedido = !!it.abertoDesde && !m?.forcar;
                  const historico = it.ultimoPedidoData
                    ? `Último pedido: ${dataCurta(it.ultimoPedidoData)}${it.ultimoPedidoQtd ? ` · ${it.ultimoPedidoQtd} un` : ""}${it.pedidos90d > 0 ? ` · ${it.pedidos90d}× em 90 dias` : ""}`
                    : "Nunca pedido";
                  return (
                    <div key={it.id} style={{ border: `1px solid ${m ? "var(--color-gold-dim)" : "var(--color-border)"}`, borderRadius: 12, padding: "0.65rem 0.75rem", background: m ? "var(--color-gold-glow-sm)" : "var(--color-surface-2)", opacity: jaPedido && !m ? 0.75 : 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <button
                          onClick={() => (jaPedido ? undefined : alternar(it))}
                          disabled={jaPedido}
                          aria-label={`Marcar ${it.nome}`}
                          style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 8, border: `2px solid ${m ? "var(--color-gold)" : "var(--color-border-light)"}`, background: m ? "var(--color-gold)" : "transparent", color: "#1a0f10", display: "flex", alignItems: "center", justifyContent: "center", cursor: jaPedido ? "default" : "pointer" }}
                        >
                          {m && <Check size={20} strokeWidth={3} />}
                        </button>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: "var(--color-cream)", fontSize: "1rem" }}>{it.nome}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>{historico}</div>
                        </div>
                      </div>

                      {jaPedido && !m && (
                        <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                          <span className="badge badge-warning">Já pedido em {dataCurta(it.abertoDesde!)} — aguardando compra</span>
                          <button
                            onClick={() => setMarcados((x) => ({ ...x, [it.id]: { quantidade: null, observacao: "", forcar: true } }))}
                            style={{ background: "none", border: "none", color: "var(--color-gold)", textDecoration: "underline", fontSize: "0.8rem", cursor: "pointer" }}
                          >
                            pedir de novo
                          </button>
                        </div>
                      )}

                      {m && (
                        <div style={{ marginTop: "0.6rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.8rem", color: "var(--color-cream-dim)", marginRight: "auto" }}>Quanto? (opcional)</span>
                            <button className="btn btn-ghost btn-icon" onClick={() => ajustarQtd(it.id, -1)} aria-label="Menos"><Minus size={16} /></button>
                            <span style={{ minWidth: 28, textAlign: "center", color: "var(--color-cream)", fontWeight: 600 }}>{m.quantidade ?? "–"}</span>
                            <button className="btn btn-ghost btn-icon" onClick={() => ajustarQtd(it.id, 1)} aria-label="Mais"><Plus size={16} /></button>
                          </div>
                          <input
                            value={m.observacao}
                            onChange={(e) => setMarcados((x) => ({ ...x, [it.id]: { ...x[it.id], observacao: e.target.value } }))}
                            placeholder="Observação (ex.: só tem 1)"
                            style={{ width: "100%", padding: "0.5rem 0.65rem", fontSize: "0.9rem", borderRadius: 8, border: "1px solid var(--color-border-light)", background: "var(--color-surface)", color: "var(--color-cream)" }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                {outros.filter((o) => o.setor === setor).map((o, idx) => (
                  <div key={`${o.nome}-${idx}`} style={{ display: "flex", alignItems: "center", gap: "0.5rem", border: "1px dashed var(--color-gold-dim)", borderRadius: 12, padding: "0.55rem 0.75rem" }}>
                    <span className="badge badge-gold">novo</span>
                    <span style={{ flex: 1, color: "var(--color-cream)" }}>{o.nome}</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => setOutros((x) => x.filter((y) => y !== o))}>Remover</button>
                  </div>
                ))}

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    value={novoOutro[setor] ?? ""}
                    onChange={(e) => setNovoOutro((n) => ({ ...n, [setor]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && adicionarOutro(setor)}
                    placeholder="Outro item não listado…"
                    style={{ flex: 1, padding: "0.6rem 0.75rem", fontSize: "0.95rem", borderRadius: 10, border: "1px solid var(--color-border-light)", background: "var(--color-surface-2)", color: "var(--color-cream)" }}
                  />
                  <button className="btn btn-ghost" onClick={() => adicionarOutro(setor)}>Adicionar</button>
                </div>
              </div>
            )}
          </section>
        );
      })}

      <textarea
        value={observacao}
        onChange={(e) => setObservacao(e.target.value)}
        placeholder="Recado para quem vai comprar (opcional)"
        rows={2}
        style={{ width: "100%", padding: "0.65rem 0.75rem", fontSize: "0.95rem", borderRadius: 10, border: "1px solid var(--color-border-light)", background: "var(--color-surface-2)", color: "var(--color-cream)", marginTop: "0.5rem" }}
      />

      {/* Barra de envio fixa no rodapé do celular */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, padding: "0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom))", background: "var(--color-surface)", borderTop: "1px solid var(--color-border)" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          {erroEnvio && <div style={{ color: "var(--color-danger)", fontSize: "0.85rem", marginBottom: "0.4rem" }}>{erroEnvio}</div>}
          <button className="btn btn-gold btn-lg" style={{ width: "100%" }} disabled={enviando} onClick={enviar}>
            <Send size={18} /> {enviando ? "Enviando…" : total === 0 ? "Enviar lista" : `Enviar lista (${total} ${total === 1 ? "item" : "itens"})`}
          </button>
        </div>
      </div>
    </div>
  );
}
