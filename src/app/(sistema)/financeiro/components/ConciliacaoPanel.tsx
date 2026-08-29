"use client";

import { useState, useEffect, useMemo } from "react";
import { CheckCircle2, ArrowRightLeft, Bot, Link2, Wand2, MessageCircle, Sparkles } from "lucide-react";
import type {
  ContaBancaria, Contato, CategoriaFinanceira, CentroCusto, Agendamento,
} from "@/lib/financeiro-data";
import { statusAgendamento, extrairContraparte } from "@/lib/financeiro-data";
import type { TransacaoBancariaImportada } from "@/lib/financeiro-data";
import CategoriaCombobox from "./CategoriaCombobox";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d?: string | null) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "sem vencimento";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const ITENS_POR_PAGINA = 10;

// ── Paginação simples client-side (a lista inteira já vem do fetch do mês/ano/conta
// selecionados — não precisa de mais uma chamada à API, só corta o array em fatias).
function Paginador({ pagina, totalPaginas, onMudar }: { pagina: number; totalPaginas: number; onMudar: (p: number) => void }) {
  if (totalPaginas <= 1) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem", padding: "0.5rem 0" }}>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onMudar(pagina - 1)} disabled={pagina <= 1}>
        Anterior
      </button>
      <span style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>Página {pagina} de {totalPaginas}</span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onMudar(pagina + 1)} disabled={pagina >= totalPaginas}>
        Próxima
      </button>
    </div>
  );
}

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
  const [syncStep, setSyncStep] = useState<"" | "sicoob" | "whatsapp">("");
  const [resumoSync, setResumoSync] = useState<string | null>(null);
  const [erroSync, setErroSync] = useState<string | null>(null);
  const [aplicandoRegra, setAplicandoRegra] = useState(false);
  const [paginaPendentes, setPaginaPendentes] = useState(1);
  const [paginaConciliadas, setPaginaConciliadas] = useState(1);

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
  useEffect(() => { setPaginaPendentes(1); setPaginaConciliadas(1); }, [contaId, mes, ano]);

  // Roda sempre nessa ordem: primeiro traz o extrato real do Sicoob (é dele que vêm as
  // transações bancárias), só depois lê os comprovantes do WhatsApp pra fazer o De/Para —
  // ler o WhatsApp antes não adianta, porque a transação correspondente ainda nem existe
  // no sistema pra casar com o comprovante.
  const handleSync = async () => {
    if (!contaId) return;
    setSyncing(true);
    setErroSync(null);
    setResumoSync(null);

    let resumoSicoob = "";
    try {
      setSyncStep("sicoob");
      const res = await fetch(`/api/financeiro/contas-bancarias/${contaId}/sincronizar-sicoob`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes, ano }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      resumoSicoob = `Sicoob: saldo ${brl(data.saldoSicoob)} — ${data.novos} transaç${data.novos === 1 ? "ão nova" : "ões novas"}, ${data.autoConciliados} conciliada${data.autoConciliados === 1 ? "" : "s"} automaticamente, ${data.pendentes} pendente${data.pendentes === 1 ? "" : "s"}.`;
    } catch (err: any) {
      setErroSync(err.message || "Erro ao sincronizar com o Sicoob");
      setSyncing(false);
      setSyncStep("");
      await Promise.all([carregarCadastros(), carregarTransacoes()]);
      return;
    }

    try {
      setSyncStep("whatsapp");
      const res = await fetch("/api/financeiro/whatsapp/sincronizar", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResumoSync(
        `${resumoSicoob} WhatsApp: ${data.novos} comprovante${data.novos === 1 ? "" : "s"} novo${data.novos === 1 ? "" : "s"}, ${data.vinculados} vinculado${data.vinculados === 1 ? "" : "s"} automaticamente, ${data.semCorrespondencia} sem correspondência ainda.`
      );
    } catch (err: any) {
      setResumoSync(resumoSicoob);
      setErroSync(`Sicoob sincronizado, mas o WhatsApp falhou: ${err.message || "erro desconhecido"}`);
    } finally {
      setSyncing(false);
      setSyncStep("");
      await Promise.all([carregarCadastros(), carregarTransacoes()]);
    }
  };

  const handleAplicarRegra = async () => {
    if (!contaId) return;
    setAplicandoRegra(true);
    setErroSync(null);
    setResumoSync(null);
    try {
      const res = await fetch(`/api/financeiro/contas-bancarias/${contaId}/aplicar-regra-entrada`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResumoSync(`${data.aplicados} entrada${data.aplicados === 1 ? "" : "s"} pendente${data.aplicados === 1 ? "" : "s"} conciliada${data.aplicados === 1 ? "" : "s"} automaticamente pela regra.`);
      await carregarTransacoes();
    } catch (err: any) {
      setErroSync(err.message || "Erro ao aplicar regra de entrada");
    } finally {
      setAplicandoRegra(false);
    }
  };

  const pendentes = transacoes.filter(t => t.status === "pendente");
  const conciliadas = transacoes.filter(t => t.status === "conciliado");
  const ignoradas = transacoes.filter(t => t.status === "ignorado");

  // Só sugere bater com uma conta existente se o valor em aberto dela for parecido com o
  // da transação — sem isso a aba "Sugestão" listava as 21 contas a pagar em aberto pra
  // qualquer PIX pequeno, sem nenhuma relação de valor (o auto-match por valor exato já
  // resolve isso na sincronização; o que sobra pendente aqui raramente bate perfeitinho,
  // então uma tolerância pequena pra revisão manual é o suficiente).
  const TOLERANCIA_SUGESTAO = 5;
  const agendamentosCompativeis = (tx: TransacaoBancariaImportada) => {
    const tipoAlvo = tx.tipo === "entrada" ? "receber" : "pagar";
    return agendamentos
      .filter(a => a.tipo === tipoAlvo)
      .filter(a => statusAgendamento(a) !== "pago")
      .filter(a => Math.abs((a.valor - a.valorPago) - tx.valor) <= TOLERANCIA_SUGESTAO)
      .sort((a, b) => Math.abs((a.valor - a.valorPago) - tx.valor) - Math.abs((b.valor - b.valorPago) - tx.valor));
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

  const totalPaginasPendentes = Math.max(1, Math.ceil(pendentes.length / ITENS_POR_PAGINA));
  const pendentesPagina = pendentes.slice((paginaPendentes - 1) * ITENS_POR_PAGINA, paginaPendentes * ITENS_POR_PAGINA);
  const totalPaginasConciliadas = Math.max(1, Math.ceil(conciliadas.length / ITENS_POR_PAGINA));
  const conciliadasPagina = conciliadas.slice((paginaConciliadas - 1) * ITENS_POR_PAGINA, paginaConciliadas * ITENS_POR_PAGINA);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 980 }}>

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
            style={{ padding: "0.5rem 1rem", borderRadius: "0.5rem", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-cream)", maxWidth: 200, textOverflow: "ellipsis" }}>
            {contasConectadas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <select value={mes} onChange={e => setMes(Number(e.target.value))}
            style={{ padding: "0.5rem 1rem", borderRadius: "0.5rem", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-cream)", maxWidth: 130 }}>
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={ano} onChange={e => setAno(Number(e.target.value))}
            style={{ padding: "0.5rem 1rem", borderRadius: "0.5rem", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-cream)", maxWidth: 90 }}>
            {[hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1].map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          <button className="btn btn-gold" onClick={handleSync} disabled={syncing} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {syncStep === "whatsapp" ? <MessageCircle size={16} /> : <Bot size={16} />}
            {syncStep === "sicoob" ? "Sincronizando extrato..." : syncStep === "whatsapp" ? "Lendo comprovantes..." : "Sincronizar"}
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

      {contaSelecionada?.regraEntradaAtiva && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <button className="btn btn-ghost btn-sm" onClick={handleAplicarRegra} disabled={aplicandoRegra}>
            <Wand2 size={13} /> {aplicandoRegra ? "Aplicando..." : "Aplicar regra de entrada às pendentes"}
          </button>
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>
            Concilia de uma vez todas as entradas pendentes desta conta (de qualquer mês) usando a regra automática configurada.
          </span>
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
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-muted)" }}>
          Pendentes de conciliação ({pendentes.length})
        </div>

        {pendentes.length === 0 ? (
          <div className="card" style={{ padding: "3rem", textAlign: "center", color: "var(--color-success)" }}>
            <CheckCircle2 size={40} style={{ margin: "0 auto 1rem auto" }} />
            <p style={{ fontWeight: 700, fontSize: "1rem" }}>Tudo conciliado!</p>
            <p style={{ fontSize: "0.85rem", color: "var(--color-muted)" }}>Nenhuma transação pendente neste período.</p>
          </div>
        ) : (
          <>
            {pendentesPagina.map(tx => (
              <PendenteCard
                key={tx.id}
                tx={tx}
                agendamentos={agendamentosCompativeis(tx)}
                contatos={contatos}
                categorias={categorias}
                centros={centros}
                onResolvido={() => { carregarTransacoes(); carregarCadastros(); }}
                onCategoriaCriada={(nova) => setCategorias(prev => [...prev, nova])}
              />
            ))}
            <Paginador pagina={paginaPendentes} totalPaginas={totalPaginasPendentes} onMudar={setPaginaPendentes} />
          </>
        )}
      </div>

      {/* CONCILIADAS */}
      {conciliadas.length > 0 && (
        <div className="card">
          <h4 style={{ fontSize: "0.8rem", color: "var(--color-muted)", textTransform: "uppercase", fontWeight: 800, marginBottom: "0.75rem" }}>
            Conciliadas ({conciliadas.length})
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {conciliadasPagina.map(tx => (
              <ConciliadaRow
                key={tx.id}
                tx={tx}
                categorias={categorias}
                onSalvo={() => carregarTransacoes()}
                onCategoriaCriada={(nova) => setCategorias(prev => [...prev, nova])}
              />
            ))}
          </div>
          <Paginador pagina={paginaConciliadas} totalPaginas={totalPaginasConciliadas} onMudar={setPaginaConciliadas} />
        </div>
      )}

      {ignoradas.length > 0 && (
        <p style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>{ignoradas.length} transaç{ignoradas.length === 1 ? "ão ignorada" : "ões ignoradas"} neste período.</p>
      )}
    </div>
  );
}

// ── Linha de uma transação já conciliada. Quando veio de um match automático do
// WhatsApp sem categoria reconhecida (selinho verde), dá pra abrir e escolher a categoria
// na mão — e "lembrar esse padrão bancário" (a contraparte do Pix, não a legenda da foto,
// que muda a cada envio) pra da próxima vez que aparecer um pagamento pro MESMO lugar já
// vir com contato e categoria certos sozinho, com ou sem foto nova no WhatsApp.
function ConciliadaRow({ tx, categorias, onSalvo, onCategoriaCriada }: {
  tx: TransacaoBancariaImportada;
  categorias: CategoriaFinanceira[];
  onSalvo: () => void;
  onCategoriaCriada: (nova: CategoriaFinanceira) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [categoriaId, setCategoriaId] = useState(tx.lancamentoCategoriaId || "");
  const [lembrarPadrao, setLembrarPadrao] = useState(!tx.lancamentoCategoriaId);
  const [padraoDescricao, setPadraoDescricao] = useState(
    (extrairContraparte(tx.descricaoComplementar) || tx.descricao || "").toLowerCase().trim()
  );
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  const semCategoria = !tx.lancamentoCategoriaId;
  const temComprovante = tx.comprovanteWhatsappLegenda !== null && tx.comprovanteWhatsappLegenda !== undefined;

  const salvar = async () => {
    if (!categoriaId) { setErro("Selecione uma categoria."); return; }
    setSaving(true);
    setErro("");
    try {
      const res = await fetch(`/api/financeiro/transacoes-bancarias/${tx.id}/categorizar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoriaId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);

      if (lembrarPadrao && padraoDescricao.trim() && tx.lancamentoContatoId) {
        await fetch("/api/financeiro/regras-conciliacao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            padraoDescricao: padraoDescricao.trim(),
            contatoId: tx.lancamentoContatoId,
            categoriaId,
            descricao: tx.comprovanteWhatsappLegenda || tx.lancamentoDescricao || tx.descricao,
          }),
        }).catch(() => {});
      }

      setAberto(false);
      onSalvo();
    } catch (err: any) {
      setErro(err.message || "Erro ao salvar categoria");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ borderBottom: "1px solid var(--color-border)", fontSize: "0.8rem" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "0.4rem 0", opacity: 0.85 }}>
        <div style={{ flex: 1, color: "var(--color-cream)", display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
          {temComprovante && (
            <span
              title={`Conciliado a partir de um comprovante do WhatsApp: "${tx.comprovanteWhatsappLegenda || "sem legenda"}"`}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: "18px", height: "18px", borderRadius: "50%",
                background: "#25D366", color: "#fff", flexShrink: 0,
              }}
            >
              <MessageCircle size={11} />
            </span>
          )}
          {tx.descricao} {tx.lancamentoDescricao && <span style={{ color: "var(--color-muted)" }}>→ {tx.lancamentoDescricao}</span>}
          {tx.lancamentoCategoriaNome ? (
            <span style={{ color: "var(--color-gold)", fontSize: "0.72rem" }}>· {tx.lancamentoCategoriaNome}</span>
          ) : (
            <span style={{ color: "var(--color-danger)", fontSize: "0.72rem" }}>· sem categoria</span>
          )}
        </div>
        <div style={{ width: "100px", textAlign: "right" }}>{tx.tipo === "entrada" ? "+" : "-"}{brl(tx.valor)}</div>
        <button
          type="button"
          onClick={() => setAberto(a => !a)}
          style={{ width: "90px", textAlign: "right", background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", color: semCategoria ? "var(--color-gold)" : "var(--color-success)" }}
        >
          {semCategoria ? "Categorizar" : "✔ Editar"}
        </button>
      </div>

      {aberto && (
        <div style={{ padding: "0.5rem 0 0.75rem 0", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {erro && <div style={{ color: "var(--color-danger)", fontSize: "0.75rem" }}>{erro}</div>}
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 220px", minWidth: 200 }}>
              <label className="form-label">Categoria</label>
              <CategoriaCombobox
                categorias={categorias}
                tipo={tx.tipo === "entrada" ? "entrada" : "saida"}
                value={categoriaId}
                onChange={setCategoriaId}
                onCriada={onCategoriaCriada}
              />
            </div>
            <button type="button" className="btn btn-gold btn-sm" onClick={salvar} disabled={saving}>
              {saving ? "..." : "Salvar"}
            </button>
          </div>
          {tx.lancamentoContatoId && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "var(--color-cream-dim)", cursor: "pointer" }}>
                <input type="checkbox" checked={lembrarPadrao} onChange={e => setLembrarPadrao(e.target.checked)} style={{ width: "auto" }} />
                Lembrar esse padrão bancário — próximos pagamentos pro mesmo lugar já vêm nessa categoria sozinhos
              </label>
              {lembrarPadrao && (
                <input
                  type="text" value={padraoDescricao} onChange={e => setPadraoDescricao(e.target.value)}
                  placeholder="trecho da descrição do banco a reconhecer" style={{ fontSize: "0.8rem" }}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Card de conciliação inline (sem modal) — cada transação pendente já mostra o
// "palpite" (contato + categoria sugeridos, aprendidos de conciliações anteriores ou do
// comprovante do WhatsApp) pré-preenchido, pronto pra confirmar com um clique só.
function PendenteCard({ tx, agendamentos, contatos, categorias, centros, onResolvido, onCategoriaCriada }: {
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
  // Quando existe um palpite pronto (contato+categoria), já mostra "Nova transação" pré-
  // preenchida — é mais rápido que forçar a escolher entre uma conta existente primeiro.
  // Sem palpite mas com uma conta existente compatível, começa em "Sugestão" (bater com ela).
  const [modo, setModo] = useState<"sugestao" | "novo">(temMatch && !temPalpite ? "sugestao" : "novo");
  const [lancamentoId, setLancamentoId] = useState(agendamentos[0]?.id || "");
  const [contatoId, setContatoId] = useState(tx.contatoSugeridoId || "");
  const [categoriaId, setCategoriaId] = useState(tx.categoriaSugeridaId || "");
  const [centroCustoId, setCentroCustoId] = useState(tx.centroCustoSugeridoId || "");
  const [descricao, setDescricao] = useState(tx.descricao || "");
  const [lembrarPadrao, setLembrarPadrao] = useState(!tx.contatoSugeridoId);
  // Prioriza a contraparte extraída da descrição complementar (nome/documento de quem
  // recebeu o Pix) — é isso que se repete entre pagamentos pro MESMO lugar. A descrição
  // genérica ("PIX EMITIDO OUTRA IF") é igual pra qualquer Pix e não reconhece ninguém.
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ignorar: true }),
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
    <div className="card" style={{ position: "relative", padding: temPalpite ? "1.75rem 1.25rem 1rem" : "1rem 1.25rem", overflow: "hidden" }}>
      {temPalpite && (
        <div style={{
          position: "absolute", top: 0, right: 0, background: "var(--color-gold)", color: "var(--color-bg)",
          fontSize: "0.65rem", fontWeight: 800, padding: "0.2rem 0.6rem", borderBottomLeftRadius: "0.5rem",
          display: "flex", alignItems: "center", gap: "0.25rem",
        }}>
          <Sparkles size={11} /> PALPITE
        </div>
      )}

      {/* Cabeçalho: data, descrição do banco, valor */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "0.75rem" }}>
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

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.75rem", borderBottom: "1px solid var(--color-border)" }}>
        {temMatch && (
          <button type="button" onClick={() => setModo("sugestao")}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: "0.4rem 0.6rem", fontSize: "0.8rem", fontWeight: 600,
              color: modo === "sugestao" ? "var(--color-gold)" : "var(--color-muted)",
              borderBottom: modo === "sugestao" ? "2px solid var(--color-gold)" : "2px solid transparent",
            }}>
            Sugestão ({agendamentos.length})
          </button>
        )}
        <button type="button" onClick={() => setModo("novo")}
          style={{
            background: "none", border: "none", cursor: "pointer", padding: "0.4rem 0.6rem", fontSize: "0.8rem", fontWeight: 600,
            color: modo === "novo" ? "var(--color-gold)" : "var(--color-muted)",
            borderBottom: modo === "novo" ? "2px solid var(--color-gold)" : "2px solid transparent",
          }}>
          Nova transação
        </button>
      </div>

      {/* Corpo */}
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
              <CategoriaCombobox
                categorias={categorias}
                tipo={tx.tipo === "entrada" ? "entrada" : "saida"}
                value={categoriaId}
                onChange={setCategoriaId}
                onCriada={onCategoriaCriada}
                placeholder="Sem categoria"
              />
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
