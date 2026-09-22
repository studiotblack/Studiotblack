"use client";

import { useState, useEffect, useMemo } from "react";
import { ArrowRightLeft, Bot, Link2, Wand2, MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import type {
  ContaBancaria, Contato, CategoriaFinanceira, CentroCusto, Agendamento,
} from "@/lib/financeiro-data";
import { statusAgendamento } from "@/lib/financeiro-data";
import type { TransacaoBancariaImportada } from "@/lib/financeiro-data";
import ResultadoSincronizacao from "./conciliacao/ResultadoSincronizacao";
import FilaPendencias from "./conciliacao/FilaPendencias";
import ListaConciliadas from "./conciliacao/ListaConciliadas";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// A sincronização do WhatsApp pode demorar (conecta, escuta um tempo, roda OCR) — se algum
// proxy/gateway na frente do servidor cortar a conexão por demorar demais, a resposta que
// chega não é o JSON da rota e sim uma página de erro genérica, e "res.json()" quebra com um
// erro críptico tipo "Unexpected token 'A'...". Lendo como texto primeiro dá pra mostrar uma
// mensagem que já explica o que aconteceu.
async function lerRespostaJson(res: Response): Promise<any> {
  const texto = await res.text();
  try {
    return JSON.parse(texto);
  } catch {
    throw new Error(
      `O servidor não respondeu em formato válido (HTTP ${res.status}) — provavelmente demorou demais e a conexão foi cortada no meio. Tente sincronizar de novo.`
    );
  }
}

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
  const [syncStep, setSyncStep] = useState<"" | "sicoob" | "whatsapp">("");
  const [resultadoSicoob, setResultadoSicoob] = useState<any | null>(null);
  const [resultadoWhatsapp, setResultadoWhatsapp] = useState<any | null>(null);
  const [erroSync, setErroSync] = useState<string | null>(null);
  const [mensagemAcao, setMensagemAcao] = useState<string | null>(null);
  const [aplicandoRegra, setAplicandoRegra] = useState(false);
  const [aplicandoRegraSaida, setAplicandoRegraSaida] = useState(false);
  const [automacaoAberta, setAutomacaoAberta] = useState(false);
  const [detalhesSicoob, setDetalhesSicoob] = useState<any[]>([]);
  const [detalhesWhatsapp, setDetalhesWhatsapp] = useState<any[]>([]);
  const [detalhesRegraSaida, setDetalhesRegraSaida] = useState<any[]>([]);
  const [refreshFila, setRefreshFila] = useState(0);

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

  // Roda sempre nessa ordem: primeiro traz o extrato real do Sicoob (é dele que vêm as
  // transações bancárias), só depois lê os comprovantes do WhatsApp pra fazer o De/Para —
  // ler o WhatsApp antes não adianta, porque a transação correspondente ainda nem existe
  // no sistema pra casar com o comprovante.
  const handleSync = async () => {
    if (!contaId) return;
    setSyncing(true);
    setErroSync(null);
    setResultadoSicoob(null);
    setResultadoWhatsapp(null);
    setDetalhesSicoob([]);
    setDetalhesWhatsapp([]);

    try {
      setSyncStep("sicoob");
      const res = await fetch(`/api/financeiro/contas-bancarias/${contaId}/sincronizar-sicoob`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes, ano }),
      });
      const data = await lerRespostaJson(res);
      if (!res.ok) throw new Error(data.error);
      setResultadoSicoob(data);
      setDetalhesSicoob(data.detalhes || []);
    } catch (err: any) {
      setErroSync(err.message || "Erro ao sincronizar com o Sicoob");
      setSyncing(false);
      setSyncStep("");
      await Promise.all([carregarCadastros(), carregarTransacoes()]);
      setRefreshFila(n => n + 1);
      return;
    }

    try {
      setSyncStep("whatsapp");
      const res = await fetch("/api/financeiro/whatsapp/sincronizar", { method: "POST" });
      const data = await lerRespostaJson(res);
      if (!res.ok) throw new Error(data.error);
      setResultadoWhatsapp(data);
      setDetalhesWhatsapp(data.detalhes || []);
    } catch (err: any) {
      setErroSync(`Sicoob sincronizado, mas o WhatsApp falhou: ${err.message || "erro desconhecido"}`);
    } finally {
      setSyncing(false);
      setSyncStep("");
      await Promise.all([carregarCadastros(), carregarTransacoes()]);
      setRefreshFila(n => n + 1);
    }
  };

  const handleAplicarRegra = async () => {
    if (!contaId) return;
    setAplicandoRegra(true);
    setErroSync(null);
    setMensagemAcao(null);
    try {
      const res = await fetch(`/api/financeiro/contas-bancarias/${contaId}/aplicar-regra-entrada`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMensagemAcao(`${data.aplicados} entrada${data.aplicados === 1 ? "" : "s"} pendente${data.aplicados === 1 ? "" : "s"} conciliada${data.aplicados === 1 ? "" : "s"} automaticamente pela regra.`);
      await carregarTransacoes();
      setRefreshFila(n => n + 1);
    } catch (err: any) {
      setErroSync(err.message || "Erro ao aplicar regra de entrada");
    } finally {
      setAplicandoRegra(false);
    }
  };

  // Regras de conciliação aprendidas (ex: "lembrar esse padrão" numa saída) só valiam pros
  // pagamentos FUTUROS do mesmo lugar — os que já estavam pendentes de antes continuavam
  // parados esperando revisão manual. Isso aplica retroativamente em cima de TODOS os
  // pendentes de saída da conta, de uma vez.
  const handleAplicarRegraSaida = async () => {
    if (!contaId) return;
    setAplicandoRegraSaida(true);
    setErroSync(null);
    setMensagemAcao(null);
    setDetalhesRegraSaida([]);
    try {
      const res = await fetch(`/api/financeiro/contas-bancarias/${contaId}/aplicar-regras-saida`, { method: "POST" });
      const data = await lerRespostaJson(res);
      if (!res.ok) throw new Error(data.error);
      setMensagemAcao(`${data.aplicados} saída${data.aplicados === 1 ? "" : "s"} pendente${data.aplicados === 1 ? "" : "s"} conciliada${data.aplicados === 1 ? "" : "s"} automaticamente por regras aprendidas (${data.semRegra} sem regra reconhecida ainda).`);
      setDetalhesRegraSaida(data.detalhes || []);
      await carregarTransacoes();
      setRefreshFila(n => n + 1);
    } catch (err: any) {
      setErroSync(err.message || "Erro ao aplicar regras de saída");
    } finally {
      setAplicandoRegraSaida(false);
    }
  };

  const pendentes = transacoes.filter(t => t.status === "pendente");
  const conciliadas = transacoes.filter(t => t.status === "conciliado");
  const ignoradas = transacoes.filter(t => t.status === "ignorado");

  // Só sugere bater com uma conta existente se o valor em aberto dela for parecido com o
  // da transação — sem isso a aba "Sugestão" listava as 21 contas a pagar em aberto pra
  // qualquer PIX pequeno, sem nenhuma relação de valor. Valor sozinho não basta: sem limite
  // de data, uma conta de setembro/2026 aparecia como sugestão pra uma transação de
  // novembro/2025 só porque o valor batia por coincidência.
  const TOLERANCIA_SUGESTAO = 5;
  const TOLERANCIA_DIAS_SUGESTAO = 45;
  const agendamentosCompativeis = (tx: TransacaoBancariaImportada) => {
    const tipoAlvo = tx.tipo === "entrada" ? "receber" : "pagar";
    const dataTx = new Date(tx.data).getTime();
    return agendamentos
      .filter(a => a.tipo === tipoAlvo)
      .filter(a => statusAgendamento(a) !== "pago")
      .filter(a => Math.abs((a.valor - a.valorPago) - tx.valor) <= TOLERANCIA_SUGESTAO)
      .filter(a => {
        const dataRef = a.dataVencimento ? new Date(a.dataVencimento).getTime() : dataTx;
        const diasDiff = Math.abs(dataTx - dataRef) / (1000 * 60 * 60 * 24);
        return diasDiff <= TOLERANCIA_DIAS_SUGESTAO;
      })
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 980 }}>

      {/* CABEÇALHO */}
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
            {syncStep === "sicoob" ? "Sincronizando extrato..." : syncStep === "whatsapp" ? "Lendo comprovantes... (até 30s)" : "Sincronizar"}
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

      <ResultadoSincronizacao
        sicoob={resultadoSicoob} whatsapp={resultadoWhatsapp}
        detalhesSicoob={detalhesSicoob} detalhesWhatsapp={detalhesWhatsapp} detalhesRegraSaida={detalhesRegraSaida}
      />

      <FilaPendencias
        transacoesPendentes={pendentes}
        agendamentosCompativeis={agendamentosCompativeis}
        contatos={contatos}
        categorias={categorias}
        centros={centros}
        refreshTrigger={refreshFila}
        onResolvidoBanco={() => { carregarTransacoes(); carregarCadastros(); setRefreshFila(n => n + 1); }}
        onCategoriaCriada={(nova) => setCategorias(prev => [...prev, nova])}
      />

      <ListaConciliadas
        conciliadas={conciliadas}
        categorias={categorias}
        onSalvo={() => carregarTransacoes()}
        onCategoriaCriada={(nova) => setCategorias(prev => [...prev, nova])}
      />

      {ignoradas.length > 0 && (
        <p style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>{ignoradas.length} transaç{ignoradas.length === 1 ? "ão ignorada" : "ões ignoradas"} neste período.</p>
      )}

      {/* AUTOMAÇÃO — ações de aplicar regra em massa, recolhidas por padrão: não fazem parte
          do fluxo principal (sincronizar), são pra quando o usuário quer forçar retroativo. */}
      <div>
        <button type="button" onClick={() => setAutomacaoAberta(v => !v)} className="btn btn-ghost btn-sm" style={{ color: "var(--color-muted)" }}>
          {automacaoAberta ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Automação avançada
        </button>
        {automacaoAberta && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.5rem", paddingLeft: "0.25rem" }}>
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
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <button className="btn btn-ghost btn-sm" onClick={handleAplicarRegraSaida} disabled={aplicandoRegraSaida}>
                <Wand2 size={13} /> {aplicandoRegraSaida ? "Aplicando..." : "Aplicar regras aprendidas às pendentes (saída)"}
              </button>
              <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>
                Concilia de uma vez todas as saídas pendentes desta conta (de qualquer mês) que batem com um padrão já ensinado (ex: "lembrar esse padrão").
              </span>
            </div>
            {mensagemAcao && (
              <div style={{ background: "rgba(46,204,113,0.08)", border: "1px solid var(--color-success)", color: "var(--color-success)", padding: "0.6rem 0.85rem", borderRadius: "0.5rem", fontSize: "0.82rem" }}>
                {mensagemAcao}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
