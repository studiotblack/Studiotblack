"use client";

import { useState, useEffect, useMemo } from "react";
import { Landmark, MessageCircle, CreditCard, Sparkles, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import type { Agendamento, Contato, CategoriaFinanceira, CentroCusto, TransacaoBancariaImportada } from "@/lib/financeiro-data";
import { statusAgendamento } from "@/lib/financeiro-data";
import CategoriaCombobox from "../CategoriaCombobox";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d?: string | null) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "sem vencimento";

type Tipo = "banco" | "whatsapp" | "cartao";

const TIPO_INFO: Record<Tipo, { label: string; icon: typeof Landmark; cor: string }> = {
  banco: { label: "Banco", icon: Landmark, cor: "#3498db" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, cor: "#25D366" },
  cartao: { label: "Cartão", icon: CreditCard, cor: "var(--color-gold)" },
};

function Etiqueta({ tipo }: { tipo: Tipo }) {
  const info = TIPO_INFO[tipo];
  const Icon = info.icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.68rem", fontWeight: 700,
      color: info.cor, textTransform: "uppercase", letterSpacing: "0.03em",
    }}>
      <Icon size={12} /> {info.label}
    </span>
  );
}

interface ItemFila {
  tipo: Tipo;
  key: string;
  data: number; // timestamp, pra ordenar
  node: React.ReactNode;
}

// ═══════════════════════════════════════════════════════════════════════
// Card de pendência bancária — sugestão de conta existente ou nova transação
// ═══════════════════════════════════════════════════════════════════════
function CardBanco({ tx, agendamentos, contatos, categorias, centros, onResolvido, onCategoriaCriada }: {
  tx: TransacaoBancariaImportada;
  agendamentos: Agendamento[];
  contatos: Contato[];
  categorias: CategoriaFinanceira[];
  centros: CentroCusto[];
  onResolvido: () => void;
  onCategoriaCriada: (nova: CategoriaFinanceira) => void;
}) {
  const temPalpite = !!(tx.contatoSugeridoId || tx.categoriaSugeridaId);
  const temMatch = agendamentos.length > 0;
  const [modo, setModo] = useState<"sugestao" | "novo">(temMatch && !temPalpite ? "sugestao" : "novo");
  const [lancamentoId, setLancamentoId] = useState(agendamentos[0]?.id || "");
  const contatoGenerico = contatos.find(c => c.nome === "Gasto Pontual");
  const [contatoId, setContatoId] = useState(tx.contatoSugeridoId || contatoGenerico?.id || "");
  const [categoriaId, setCategoriaId] = useState(tx.categoriaSugeridaId || "");
  const [centroCustoId, setCentroCustoId] = useState(tx.centroCustoSugeridoId || "");
  const [descricao, setDescricao] = useState(tx.descricao || "");
  const [lembrarPadrao, setLembrarPadrao] = useState(!tx.contatoSugeridoId);
  const [padraoDescricao, setPadraoDescricao] = useState(
    (extrairContraparte(tx.descricaoComplementar) || tx.descricao || "").toLowerCase().trim()
  );
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  const confirmar = async () => {
    setErro("");
    if (modo === "sugestao" && !lancamentoId) { setErro("Selecione uma conta a pagar/receber."); return; }
    if (modo === "novo" && !contatoId) { setErro("Selecione um contato."); return; }
    setSaving(true);
    try {
      const body = modo === "sugestao"
        ? { lancamentoId }
        : { novoLancamento: { contatoId, categoriaId: categoriaId || undefined, centroCustoId: centroCustoId || undefined, descricao } };
      const res = await fetch(`/api/financeiro/transacoes-bancarias/${tx.id}/conciliar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);

      if (modo === "novo" && lembrarPadrao && padraoDescricao.trim()) {
        await fetch("/api/financeiro/regras-conciliacao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ padraoDescricao: padraoDescricao.trim(), contatoId, categoriaId: categoriaId || undefined, centroCustoId: centroCustoId || undefined, descricao }),
        }).catch(() => {});
      }
      onResolvido();
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
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ignorar: true }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onResolvido();
    } catch (err: any) {
      setErro(err.message || "Erro ao ignorar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ position: "relative", padding: temPalpite ? "1.75rem 1.25rem 1rem" : "1rem 1.25rem" }}>
      {temPalpite && (
        <div style={{
          position: "absolute", top: 0, right: 0, background: "var(--color-gold)", color: "var(--color-bg)",
          fontSize: "0.65rem", fontWeight: 800, padding: "0.2rem 0.6rem",
          borderTopRightRadius: "1rem", borderBottomLeftRadius: "0.5rem",
          display: "flex", alignItems: "center", gap: "0.25rem",
        }}>
          <Sparkles size={11} /> PALPITE
        </div>
      )}

      <Etiqueta tipo="banco" />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", margin: "0.4rem 0 0.75rem" }}>
        <div>
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>{fmtData(tx.data)}</span>
          <p style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--color-cream)", margin: "0.15rem 0 0 0" }}>{tx.descricao}</p>
          {tx.descricaoComplementar && (
            <p style={{ fontSize: "0.75rem", color: "var(--color-muted)", margin: "0.1rem 0 0 0" }}>{tx.descricaoComplementar}</p>
          )}
        </div>
        <span style={{ fontWeight: 800, fontSize: "1.05rem", color: tx.tipo === "entrada" ? "var(--color-success)" : "var(--color-danger)", whiteSpace: "nowrap" }}>
          {tx.tipo === "entrada" ? "+" : "-"}{brl(tx.valor)}
        </span>
      </div>

      {(tx.contatoSugeridoNome || tx.categoriaSugeridaNome) && (
        <div style={{ background: "rgba(212,175,140,0.08)", border: "1px solid var(--color-gold)", color: "var(--color-gold)", padding: "0.5rem 0.75rem", borderRadius: "0.5rem", fontSize: "0.78rem", marginBottom: "0.75rem" }}>
          {tx.contatoSugeridoNome && <>Reconhecido como <strong>{tx.contatoSugeridoNome}</strong>{tx.categoriaSugeridaNome ? " — " : ""}</>}
          {tx.categoriaSugeridaNome && <>categoria <strong>{tx.categoriaSugeridaNome}</strong></>}
          {tx.comprovanteLegenda && ` (comprovante WhatsApp: "${tx.comprovanteLegenda}")`}
        </div>
      )}

      {erro && <div style={{ background: "rgba(231,76,60,0.1)", border: "1px solid var(--color-danger)", color: "var(--color-danger)", padding: "0.5rem 0.75rem", borderRadius: "0.5rem", fontSize: "0.8rem", marginBottom: "0.75rem" }}>{erro}</div>}

      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.75rem", borderBottom: "1px solid var(--color-border)" }}>
        {temMatch && (
          <button type="button" onClick={() => setModo("sugestao")}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "0.4rem 0.6rem", fontSize: "0.8rem", fontWeight: 600, color: modo === "sugestao" ? "var(--color-gold)" : "var(--color-muted)", borderBottom: modo === "sugestao" ? "2px solid var(--color-gold)" : "2px solid transparent" }}>
            Sugestão ({agendamentos.length})
          </button>
        )}
        <button type="button" onClick={() => setModo("novo")}
          style={{ background: "none", border: "none", cursor: "pointer", padding: "0.4rem 0.6rem", fontSize: "0.8rem", fontWeight: 600, color: modo === "novo" ? "var(--color-gold)" : "var(--color-muted)", borderBottom: modo === "novo" ? "2px solid var(--color-gold)" : "2px solid transparent" }}>
          Nova transação
        </button>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap" }}>
        {modo === "sugestao" ? (
          <div style={{ flex: 1, minWidth: 260 }}>
            <label className="form-label">Conta a {tx.tipo === "entrada" ? "receber" : "pagar"}</label>
            <select value={lancamentoId} onChange={e => setLancamentoId(e.target.value)}>
              {agendamentos.map(a => (
                <option key={a.id} value={a.id}>
                  {a.descricao} — {a.contatoNome} — {brl(a.valor - a.valorPago)} em aberto (venc. {fmtData(a.dataVencimento)})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div style={{ flex: "1 1 200px", minWidth: 180 }}>
              <label className="form-label">Contato</label>
              <select value={contatoId} onChange={e => setContatoId(e.target.value)}>
                <option value="">Selecione...</option>
                {contatos.filter(c => c.ativo).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div style={{ flex: "1 1 220px", minWidth: 200 }}>
              <label className="form-label">Categoria</label>
              <CategoriaCombobox categorias={categorias} tipo={tx.tipo === "entrada" ? "entrada" : "saida"} value={categoriaId} onChange={setCategoriaId} onCriada={onCategoriaCriada} placeholder="Sem categoria" />
            </div>
            <div style={{ flex: "1 1 200px", minWidth: 180 }}>
              <label className="form-label">Descrição</label>
              <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)} />
            </div>
          </>
        )}
        <button type="button" className="btn btn-gold" onClick={confirmar} disabled={saving} style={{ height: "2.5rem", paddingLeft: "1.5rem", paddingRight: "1.5rem" }}>
          {saving ? "..." : "OK"}
        </button>
      </div>

      {modo === "novo" && (
        <div style={{ marginTop: "0.6rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 200px", minWidth: 180 }}>
              <label className="form-label">Centro de custo (opcional)</label>
              <select value={centroCustoId} onChange={e => setCentroCustoId(e.target.value)}>
                <option value="">Sem centro de custo</option>
                {centros.filter(c => c.ativo).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "var(--color-cream-dim)", cursor: "pointer", marginTop: "1.2rem" }}>
              <input type="checkbox" checked={lembrarPadrao} onChange={e => setLembrarPadrao(e.target.checked)} style={{ width: "auto" }} />
              Lembrar esse padrão
            </label>
          </div>
          {lembrarPadrao && (
            <input type="text" value={padraoDescricao} onChange={e => setPadraoDescricao(e.target.value)} placeholder="trecho da descrição do banco a reconhecer, ex: sabesp" style={{ fontSize: "0.8rem" }} />
          )}
        </div>
      )}

      <div style={{ textAlign: "right", marginTop: "0.5rem" }}>
        <button type="button" onClick={ignorar} disabled={saving} style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer", fontSize: "0.75rem", textDecoration: "underline" }}>
          Ignorar transação
        </button>
      </div>
    </div>
  );
}

function extrairContraparte(descricaoComplementar?: string | null): string {
  if (!descricaoComplementar) return "";
  const partes = descricaoComplementar.split("|@").map(p => p.trim()).filter(Boolean);
  return partes[1] || "";
}

// ═══════════════════════════════════════════════════════════════════════
// Card de comprovante do WhatsApp sem resolver
// ═══════════════════════════════════════════════════════════════════════
function CardWhatsapp({ item, onResolvido }: { item: any; onResolvido: () => void }) {
  const [modo, setModo] = useState<"" | "valor" | "cartao">("");
  const [valor, setValor] = useState(item.valorOcr ? String(item.valorOcr) : "");
  const [parcelas, setParcelas] = useState("1");
  const [valorParcela, setValorParcela] = useState(item.valorOcr ? String(item.valorOcr) : "");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<string | null>(null);

  const ehErroCartao = item.status === "erro_cartao";

  const salvarValor = async () => {
    const v = parseFloat(valor.replace(",", "."));
    if (!v || v <= 0) { setErro("Digite um valor válido."); return; }
    setSaving(true);
    setErro("");
    try {
      const res = await fetch(`/api/financeiro/whatsapp/comprovantes/${item.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ valorOcr: v }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.resultado?.status === "vinculado") {
        setResultado(`Vinculado! ${brl(data.resultado.valor)}${data.resultado.contato ? ` — ${data.resultado.contato}` : ""}`);
        setTimeout(onResolvido, 1200);
      } else {
        setErro(`Salvo, mas ainda sem correspondência (${data.resultado?.motivo || "sem transação compatível"}).`);
        onResolvido();
      }
    } catch (err: any) {
      setErro(err.message || "Erro ao salvar valor");
    } finally {
      setSaving(false);
    }
  };

  const marcarCartao = async () => {
    const n = parseInt(parcelas, 10) || 1;
    const v = parseFloat(valorParcela.replace(",", "."));
    if (!v || v <= 0) { setErro("Digite o valor da parcela."); return; }
    setSaving(true);
    setErro("");
    try {
      const res = await fetch(`/api/financeiro/whatsapp/comprovantes/${item.id}/marcar-cartao`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ parcelas: n, valorParcela: v }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onResolvido();
    } catch (err: any) {
      setErro(err.message || "Erro ao marcar como cartão");
    } finally {
      setSaving(false);
    }
  };

  const ignorar = async () => {
    setSaving(true);
    setErro("");
    try {
      const res = await fetch(`/api/financeiro/whatsapp/comprovantes/${item.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ignorar: true }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onResolvido();
    } catch (err: any) {
      setErro(err.message || "Erro ao ignorar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ padding: "0.9rem 1.1rem" }}>
      <Etiqueta tipo="whatsapp" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", margin: "0.4rem 0 0" }}>
        <div>
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>{new Date(item.dataHoraEnvio).toLocaleString("pt-BR")}</span>
          <p style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--color-cream)", margin: "0.15rem 0 0 0" }}>
            {item.textoLegenda || <em style={{ color: "var(--color-muted)", fontWeight: 400 }}>sem legenda</em>}
          </p>
          <p style={{ fontSize: "0.78rem", color: ehErroCartao ? "var(--color-gold)" : "var(--color-danger)", margin: "0.2rem 0 0 0" }}>
            {ehErroCartao
              ? "Marcado como cartão, mas não deu pra ler o valor/parcela sozinho — preencha abaixo."
              : item.valorOcr
                ? `Valor lido: ${brl(item.valorOcr)} — nenhuma transação bancária bateu com esse valor/data ainda.`
                : "Não consegui ler nenhum valor nessa imagem (nem na legenda, nem no OCR)."}
          </p>
        </div>
        <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--color-cream-dim)", whiteSpace: "nowrap" }}>
          {item.valorOcr ? brl(item.valorOcr) : "—"}
        </span>
      </div>

      {erro && <div style={{ marginTop: "0.6rem", fontSize: "0.78rem", color: "var(--color-danger)" }}>{erro}</div>}
      {resultado && <div style={{ marginTop: "0.6rem", fontSize: "0.78rem", color: "var(--color-success)" }}>{resultado}</div>}

      {!modo && (
        <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem" }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModo("valor")}>Corrigir valor e tentar vincular</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModo("cartao")}>Marcar como compra no cartão</button>
          <button type="button" onClick={ignorar} disabled={saving} style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer", fontSize: "0.78rem", textDecoration: "underline" }}>
            Ignorar
          </button>
        </div>
      )}

      {modo === "valor" && (
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", marginTop: "0.75rem", flexWrap: "wrap" }}>
          <div style={{ minWidth: 160 }}>
            <label className="form-label">Valor correto</label>
            <input type="text" value={valor} onChange={e => setValor(e.target.value)} placeholder="ex: 105,36" />
          </div>
          <button type="button" className="btn btn-gold btn-sm" onClick={salvarValor} disabled={saving}>{saving ? "..." : "Salvar e tentar vincular"}</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModo("")} disabled={saving}>Cancelar</button>
        </div>
      )}

      {modo === "cartao" && (
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", marginTop: "0.75rem", flexWrap: "wrap" }}>
          <div style={{ minWidth: 100 }}>
            <label className="form-label">Parcelas</label>
            <input type="number" min={1} max={24} value={parcelas} onChange={e => setParcelas(e.target.value)} />
          </div>
          <div style={{ minWidth: 160 }}>
            <label className="form-label">Valor de cada parcela</label>
            <input type="text" value={valorParcela} onChange={e => setValorParcela(e.target.value)} placeholder="ex: 105,36" />
          </div>
          <button type="button" className="btn btn-gold btn-sm" onClick={marcarCartao} disabled={saving}>{saving ? "..." : "Confirmar"}</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModo("")} disabled={saving}>Cancelar</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Card de fatura do cartão pronta pra confirmar
// ═══════════════════════════════════════════════════════════════════════
function CardFatura({ s, onConciliado }: { s: any; onConciliado: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState("");

  const confirmar = async () => {
    setConfirmando(true);
    setErro("");
    try {
      const res = await fetch(`/api/financeiro/cartao-credito/sugestoes/${s.transacaoId}/confirmar`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      onConciliado();
    } catch (err: any) {
      setErro(err.message || "Erro ao confirmar fatura");
    } finally {
      setConfirmando(false);
    }
  };

  return (
    <div className="card" style={{ padding: "1rem 1.25rem", border: "1px solid var(--color-gold)" }}>
      <Etiqueta tipo="cartao" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", margin: "0.4rem 0 0.6rem" }}>
        <div>
          <p style={{ fontWeight: 700, color: "var(--color-cream)", margin: 0 }}>
            Fatura de {new Date(s.dataTransacao + "T12:00:00").toLocaleDateString("pt-BR")}: {brl(s.valorTransacao)}
          </p>
          <p style={{ fontSize: "0.78rem", color: "var(--color-muted)", margin: "0.15rem 0 0 0" }}>
            = soma de {s.compras.length} compra{s.compras.length === 1 ? "" : "s"} acumulada{s.compras.length === 1 ? "" : "s"} ({brl(s.somaCompras)})
          </p>
        </div>
        <button type="button" className="btn btn-gold btn-sm" onClick={confirmar} disabled={confirmando}>
          {confirmando ? "Confirmando..." : "Confirmar baixa"}
        </button>
      </div>
      {erro && <div style={{ fontSize: "0.78rem", color: "var(--color-danger)", marginBottom: "0.5rem" }}>{erro}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
        {s.compras.map((c: any) => (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--color-cream-dim)" }}>
            <span>{c.descricao || "sem legenda"} {c.parcelaTotal > 1 && `(parcela ${c.parcelaNumero}/${c.parcelaTotal})`}</span>
            <span>{brl(c.valorParcela)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Orquestrador: junta os 3 tipos numa fila só, ordenada por data, com filtro
// ═══════════════════════════════════════════════════════════════════════
export default function FilaPendencias({
  transacoesPendentes, agendamentosCompativeis, contatos, categorias, centros,
  refreshTrigger, onResolvidoBanco, onCategoriaCriada,
}: {
  transacoesPendentes: TransacaoBancariaImportada[];
  agendamentosCompativeis: (tx: TransacaoBancariaImportada) => Agendamento[];
  contatos: Contato[];
  categorias: CategoriaFinanceira[];
  centros: CentroCusto[];
  refreshTrigger: number;
  onResolvidoBanco: () => void;
  onCategoriaCriada: (nova: CategoriaFinanceira) => void;
}) {
  const [comprovantes, setComprovantes] = useState<any[]>([]);
  const [faturaSugestoes, setFaturaSugestoes] = useState<any[]>([]);
  const [faturaAcumulada, setFaturaAcumulada] = useState<any[]>([]);
  const [mostrarAcumulado, setMostrarAcumulado] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const [filtro, setFiltro] = useState<"todos" | Tipo>("todos");

  const carregarWhatsapp = async () => {
    const res = await fetch("/api/financeiro/whatsapp/comprovantes");
    setComprovantes(res.ok ? await res.json() : []);
  };
  const carregarFatura = async () => {
    const res = await fetch("/api/financeiro/cartao-credito/sugestoes");
    const data = res.ok ? await res.json() : {};
    setFaturaSugestoes(data.sugestoes || []);
    setFaturaAcumulada(data.pendentes || []);
  };

  useEffect(() => {
    (async () => {
      await Promise.all([carregarWhatsapp(), carregarFatura()]);
      setCarregado(true);
    })();
  }, [refreshTrigger]);

  const itens = useMemo<ItemFila[]>(() => {
    const lista: ItemFila[] = [];
    for (const tx of transacoesPendentes) {
      lista.push({
        tipo: "banco", key: tx.id, data: new Date(tx.data).getTime(),
        node: (
          <CardBanco
            key={tx.id} tx={tx} agendamentos={agendamentosCompativeis(tx)}
            contatos={contatos} categorias={categorias} centros={centros}
            onResolvido={onResolvidoBanco} onCategoriaCriada={onCategoriaCriada}
          />
        ),
      });
    }
    for (const item of comprovantes) {
      lista.push({
        tipo: "whatsapp", key: item.id, data: new Date(item.dataHoraEnvio).getTime(),
        node: <CardWhatsapp key={item.id} item={item} onResolvido={() => { carregarWhatsapp(); onResolvidoBanco(); }} />,
      });
    }
    for (const s of faturaSugestoes) {
      lista.push({
        tipo: "cartao", key: s.transacaoId, data: new Date(s.dataTransacao).getTime(),
        node: <CardFatura key={s.transacaoId} s={s} onConciliado={() => { carregarFatura(); onResolvidoBanco(); }} />,
      });
    }
    return lista.sort((a, b) => b.data - a.data);
  }, [transacoesPendentes, comprovantes, faturaSugestoes, contatos, categorias, centros]);

  const contagem = {
    banco: itens.filter(i => i.tipo === "banco").length,
    whatsapp: itens.filter(i => i.tipo === "whatsapp").length,
    cartao: itens.filter(i => i.tipo === "cartao").length,
  };
  const total = itens.length;
  const itensFiltrados = filtro === "todos" ? itens : itens.filter(i => i.tipo === filtro);

  const somaAcumulada = faturaAcumulada.reduce((acc, c) => acc + c.valorParcela, 0);
  const porMes = faturaAcumulada.reduce((acc: Record<string, any[]>, c: any) => {
    (acc[c.mesReferencia] ||= []).push(c);
    return acc;
  }, {});

  if (!carregado && transacoesPendentes.length === 0) return null;

  return (
    <div id="secao-pendencias" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.8rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-muted)" }}>
          Esperando você
        </span>
        {(["todos", "banco", "whatsapp", "cartao"] as const).map(f => {
          const n = f === "todos" ? total : contagem[f];
          const label = f === "todos" ? "Todos" : TIPO_INFO[f].label;
          return (
            <button
              key={f} type="button" onClick={() => setFiltro(f)}
              className={filtro === f ? "btn btn-gold btn-sm" : "btn btn-ghost btn-sm"}
              style={{ fontSize: "0.75rem" }}
            >
              {label} ({n})
            </button>
          );
        })}
      </div>

      {itensFiltrados.length === 0 ? (
        <div className="card" style={{ padding: "3rem", textAlign: "center", color: "var(--color-success)" }}>
          <CheckCircle2 size={40} style={{ margin: "0 auto 1rem auto" }} />
          <p style={{ fontWeight: 700, fontSize: "1rem" }}>Tudo em dia!</p>
          <p style={{ fontSize: "0.85rem", color: "var(--color-muted)" }}>Nada esperando sua decisão agora.</p>
        </div>
      ) : (
        itensFiltrados.map(i => i.node)
      )}

      {faturaAcumulada.length > 0 && (
        <div className="card" style={{ padding: "0.75rem 1rem" }}>
          <button type="button" onClick={() => setMostrarAcumulado(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem", width: "100%", textAlign: "left", padding: 0 }}>
            {mostrarAcumulado ? <ChevronUp size={13} color="var(--color-muted)" /> : <ChevronDown size={13} color="var(--color-muted)" />}
            <span style={{ fontSize: "0.78rem", color: "var(--color-muted)" }}>
              <strong style={{ color: "var(--color-cream)" }}>{brl(somaAcumulada)}</strong> em {faturaAcumulada.length} compra{faturaAcumulada.length === 1 ? "" : "s"} no cartão acumuladas, aguardando a fatura aparecer no extrato — nada pra fazer ainda
            </span>
          </button>
          {mostrarAcumulado && (
            <div style={{ marginTop: "0.6rem", paddingLeft: "1.25rem" }}>
              {Object.entries(porMes).map(([mes, compras]) => (
                <div key={mes} style={{ marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--color-gold)", fontWeight: 700 }}>{mes}</span>
                  {(compras as any[]).map((c: any) => (
                    <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--color-cream-dim)", padding: "0.15rem 0" }}>
                      <span>{c.descricao || "sem legenda"} {c.parcelaTotal > 1 && `(parcela ${c.parcelaNumero}/${c.parcelaTotal})`} {c.contaNome ? `· ${c.contaNome}` : ""}</span>
                      <span>{brl(c.valorParcela)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
