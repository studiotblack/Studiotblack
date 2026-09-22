"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ArrowUpRight, ArrowDownRight, Landmark, Calendar, Pencil, AlertTriangle, Home, Percent,
  TrendingUp, TrendingDown, Wallet, BatteryWarning, Target, DollarSign, ArrowLeftRight, Info, Scale,
} from "lucide-react";
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line, LineChart,
} from "recharts";
import type { ContaBancaria, Agendamento } from "@/lib/financeiro-data";
import { statusAgendamento, STATUS_COLORS, STATUS_LABELS } from "@/lib/financeiro-data";
import type { DreLinhaImportada } from "@/lib/dre-data";
import { computeIndicadoresDre, computeIndicadoresDreMes, MESES_ABREV, MESES_FULL, DRE_MES_CAMPOS, isDreLinhaDetalhe } from "@/lib/dre-data";
import type { DesempenhoProfissional } from "@/lib/performance-data";
import { getMesAno, getTotalFaturado } from "@/lib/performance-data";

interface BaixaComTipo {
  id: string;
  agendamentoId: string;
  valor: number;
  data: string;
  contaBancariaId: string;
  agendamentoTipo: "pagar" | "receber";
}

interface TransferenciaRow {
  id: string;
  contaOrigemId: string;
  contaDestinoId: string;
  valor: number;
  data: string;
}

interface FluxoCaixaPanelProps {
  dreLinhas: DreLinhaImportada[];
  anoDre: number;
  onAbrirFaturamento?: () => void;
}

interface ConciliacaoFaturamentoResumo {
  totalAppBarber: number;
  totalBanco: number;
  totalDinheiro: number;
  statusMes: "ok" | "revisar";
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d: string | null | undefined) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";

// Lê o valor de uma linha específica do DRE (por nome exato) num mês específico — mesma
// lógica interna de computeIndicadoresDreMes, mas aberta pra poder somar/comparar vários
// meses de uma vez (média móvel, tendência), sem precisar de uma função nova em dre-data.ts.
const valorLinhaMes = (linhas: DreLinhaImportada[], nomeExato: string, mesIndex: number): number => {
  const campo = DRE_MES_CAMPOS[mesIndex];
  const linha = linhas.find(l => l.resultado === nomeExato);
  return linha ? (linha[campo] as number) : 0;
};

// Primeiro número antes da primeira barra de uma data "DD/MM/YYYY HH:mm" — usado pra
// comparar "mesmo período" (mesmo dia do mês) entre o mês atual e o mês passado.
const diaDoMes = (dataStr: string): number => parseInt(dataStr.split(" ")[0].split("/")[0], 10) || 0;

function InsightChip({ icon: Icon, label, value, sub, tone }: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string; value: string; sub?: string;
  tone: "success" | "warning" | "danger" | "info" | "muted";
}) {
  const cor = `var(--color-${tone === "muted" ? "muted" : tone})`;
  const bg = tone === "muted" ? "var(--color-surface-2)" : `var(--color-${tone}-dim)`;
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: "0.6rem", padding: "0.75rem 1rem",
      background: bg, border: `1px solid ${tone === "muted" ? "var(--color-border)" : cor}`,
      borderRadius: "0.75rem", minWidth: 180, flex: "1 1 200px",
    }}>
      <Icon size={16} color={cor} />
      <div>
        <div style={{ fontSize: "0.68rem", color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
        <div style={{ fontSize: "1rem", fontWeight: 700, color: cor }}>{value}</div>
        {sub && <div style={{ fontSize: "0.7rem", color: "var(--color-muted)" }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function FluxoCaixaPanel({ dreLinhas, anoDre, onAbrirFaturamento }: FluxoCaixaPanelProps) {
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [baixas, setBaixas] = useState<BaixaComTipo[]>([]);
  const [transferencias, setTransferencias] = useState<TransferenciaRow[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [perfData, setPerfData] = useState<DesempenhoProfissional[]>([]);
  const [conciliacaoFaturamento, setConciliacaoFaturamento] = useState<ConciliacaoFaturamentoResumo | null>(null);
  const [loading, setLoading] = useState(true);

  // Meta de faturamento mensal do negócio (card "Receita Real do Mês")
  const [meta, setMeta] = useState(0);
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [metaInput, setMetaInput] = useState("");

  useEffect(() => {
    const carregar = async () => {
      setLoading(true);
      try {
        const hoje = new Date();
        const mesAnoCorrente = `${String(hoje.getMonth() + 1).padStart(2, "0")}/${hoje.getFullYear()}`;
        const [rContas, rBaixas, rTransf, rPagar, rReceber, rMeta, rPerf, rConciliacao] = await Promise.all([
          fetch("/api/financeiro/contas-bancarias"),
          fetch("/api/financeiro/baixas"),
          fetch("/api/financeiro/transferencias"),
          fetch("/api/financeiro/agendamentos?tipo=pagar"),
          fetch("/api/financeiro/agendamentos?tipo=receber"),
          fetch("/api/financeiro/meta"),
          fetch("/api/performance/comissoes"),
          fetch(`/api/financeiro/conciliacao-faturamento?mesAno=${encodeURIComponent(mesAnoCorrente)}`),
        ]);
        setContas(rContas.ok ? await rContas.json() : []);
        setBaixas(rBaixas.ok ? await rBaixas.json() : []);
        setTransferencias(rTransf.ok ? await rTransf.json() : []);
        const pagar = rPagar.ok ? await rPagar.json() : [];
        const receber = rReceber.ok ? await rReceber.json() : [];
        setAgendamentos([...pagar, ...receber]);
        const metaData = rMeta.ok ? await rMeta.json() : { metaReceitaMensal: 0 };
        setMeta(metaData.metaReceitaMensal || 0);
        setPerfData(rPerf.ok ? await rPerf.json() : []);
        setConciliacaoFaturamento(rConciliacao.ok ? await rConciliacao.json() : null);
      } catch (err) {
        console.error("Erro ao carregar fluxo de caixa:", err);
      } finally {
        setLoading(false);
      }
    };
    carregar();
  }, []);

  const abrirEdicaoMeta = () => {
    setMetaInput(meta > 0 ? String(meta) : "");
    setEditandoMeta(true);
  };

  const salvarMeta = async () => {
    const valor = parseFloat(metaInput.replace(/\./g, "").replace(",", "."));
    if (isNaN(valor) || valor < 0) {
      setEditandoMeta(false);
      return;
    }
    try {
      const res = await fetch("/api/financeiro/meta", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metaReceitaMensal: valor }),
      });
      if (res.ok) {
        const data = await res.json();
        setMeta(data.metaReceitaMensal);
      }
    } catch (err) {
      console.error("Erro ao salvar meta:", err);
    } finally {
      setEditandoMeta(false);
    }
  };

  const saldoPorConta = useMemo(() => {
    return contas.map(conta => {
      // Conta conectada ao Sicoob: confia no saldo real puxado do banco em vez de calcular
      // localmente (evita divergência se alguma baixa não foi lançada no sistema).
      if (conta.sicoobClientId && conta.saldoSicoob !== undefined && conta.saldoSicoob !== null) {
        return { ...conta, saldoAtual: conta.saldoSicoob, saldoReal: true as const };
      }
      const entradas = baixas.filter(b => b.contaBancariaId === conta.id && b.agendamentoTipo === "receber").reduce((a, b) => a + b.valor, 0);
      const saidas = baixas.filter(b => b.contaBancariaId === conta.id && b.agendamentoTipo === "pagar").reduce((a, b) => a + b.valor, 0);
      const transfRecebidas = transferencias.filter(t => t.contaDestinoId === conta.id).reduce((a, t) => a + t.valor, 0);
      const transfEnviadas = transferencias.filter(t => t.contaOrigemId === conta.id).reduce((a, t) => a + t.valor, 0);
      const saldoAtual = conta.saldoInicial + entradas - saidas + transfRecebidas - transfEnviadas;
      return { ...conta, saldoAtual, saldoReal: false as const };
    });
  }, [contas, baixas, transferencias]);

  const saldoConsolidado = saldoPorConta.reduce((a, c) => a + c.saldoAtual, 0);

  // ── Datas de referência (hoje, mês atual, mês anterior) — centralizadas aqui pra não
  // espalhar "new Date()" por vários useMemo diferentes ──────────────────────────────
  const hoje = new Date();
  const diaAtualNum = hoje.getDate();
  const anoAtual = hoje.getFullYear();
  const mesAtualIndex = hoje.getMonth(); // 0 = Jan
  const diasNoMesAtual = new Date(anoAtual, mesAtualIndex + 1, 0).getDate();
  const dreDoAnoCorrente = anoDre === anoAtual;

  let mesAnteriorIdx = mesAtualIndex - 1;
  let anoMesAnterior = anoAtual;
  if (mesAnteriorIdx < 0) { mesAnteriorIdx = 11; anoMesAnterior = anoAtual - 1; }
  const mesAtualChave = `${String(mesAtualIndex + 1).padStart(2, "0")}/${anoAtual}`;
  const mesAnteriorChave = `${String(mesAnteriorIdx + 1).padStart(2, "0")}/${anoMesAnterior}`;

  // ── Receita/Lucro do Mês — lidos direto do DRE (Nibo p/ meses fechados, sistema ao vivo
  // pro mês corrente). Continua alimentando a projeção e a reconciliação com o Performance,
  // mas deixou de ser o número de destaque isolado (ver Card "Receita Real do Mês" abaixo).
  const { receitaMes } = useMemo(
    () => (dreDoAnoCorrente ? computeIndicadoresDreMes(dreLinhas, mesAtualIndex) : { receitaMes: 0, resultadoOperacionalMes: 0, margemOperacionalMes: 0 }),
    [dreLinhas, dreDoAnoCorrente, mesAtualIndex]
  );
  const dreDoMesDisponivel = dreDoAnoCorrente && receitaMes !== 0;

  // ── Receita real do mês, direto das vendas (Performance/AppBarber) — é o sinal mais
  // atual e granular que existe; a meta de faturamento passa a ser medida contra ele.
  const receitaPerformanceMesAtual = useMemo(
    () => getTotalFaturado(perfData.filter(d => getMesAno(d.data) === mesAtualChave)),
    [perfData, mesAtualChave]
  );
  const receitaPerformanceMesAnteriorAteHoje = useMemo(
    () => getTotalFaturado(perfData.filter(d => getMesAno(d.data) === mesAnteriorChave && diaDoMes(d.data) <= diaAtualNum)),
    [perfData, mesAnteriorChave, diaAtualNum]
  );
  const deltaReceitaPerf = receitaPerformanceMesAnteriorAteHoje > 0
    ? ((receitaPerformanceMesAtual - receitaPerformanceMesAnteriorAteHoje) / receitaPerformanceMesAnteriorAteHoje) * 100
    : null;
  const progressoMeta = meta > 0 ? Math.min((receitaPerformanceMesAtual / meta) * 100, 100) : 0;

  // ── Projeção de resultado do mês — corrige o viés de "meio do mês": em vez de comparar
  // a receita parcial de hoje com despesas já lançadas pro mês inteiro, projeta a receita
  // no ritmo atual (dia X de Y) e usa a média de despesa dos últimos meses FECHADOS como
  // referência (mais estável que o mês corrente, que ainda está sendo lançado).
  const projecaoMesCorrente = useMemo(() => {
    if (!dreDoAnoCorrente) return null;
    const receitaProjetada = diaAtualNum > 0 ? (receitaMes / diaAtualNum) * diasNoMesAtual : 0;

    const despesasTrailing: number[] = [];
    for (let idx = mesAtualIndex - 1; idx >= 0 && despesasTrailing.length < 3; idx--) {
      const receitaCampo = valorLinhaMes(dreLinhas, "RECEITAS OPERACIONAIS", idx);
      if (receitaCampo === 0) continue; // mês sem dado nenhum — não entra na média
      const resultadoCampo = valorLinhaMes(dreLinhas, "RESULTADO OPERACIONAL", idx);
      despesasTrailing.push(receitaCampo - resultadoCampo);
    }
    const despesaMediaTrailing = despesasTrailing.length > 0
      ? despesasTrailing.reduce((a, b) => a + b, 0) / despesasTrailing.length
      : 0;

    const resultadoProjetado = receitaProjetada - despesaMediaTrailing;
    const margemProjetada = receitaProjetada > 0 ? (resultadoProjetado / receitaProjetada) * 100 : 0;
    return { receitaProjetada, resultadoProjetado, margemProjetada, mesesUsados: despesasTrailing.length };
  }, [dreDoAnoCorrente, receitaMes, diaAtualNum, diasNoMesAtual, mesAtualIndex, dreLinhas]);

  // ── Compromissos financeiros dos próximos 30 dias (contas a PAGAR ainda em aberto) ──
  // Conta como compromisso: qualquer conta a pagar não quitada que já venceu (mesmo que
  // há tempo — ainda é dinheiro que se deve), que vence dentro dos próximos 30 dias, OU
  // que ainda não tem data de vencimento definida (contas fixas recorrentes como aluguel
  // e comissões são compromissos reais mesmo antes de a data exata ser cadastrada).
  const { compromissos30Dias, qtdCompromissos30Dias } = useMemo(() => {
    const hojeZero = new Date(); hojeZero.setHours(0, 0, 0, 0);
    const limite = new Date(hojeZero); limite.setDate(hojeZero.getDate() + 30);
    const pendentes = agendamentos.filter(a => {
      if (a.tipo !== "pagar") return false;
      if (statusAgendamento(a) === "pago") return false;
      if (!a.dataVencimento) return true;
      const venc = new Date(a.dataVencimento + "T00:00:00");
      return venc <= limite;
    });
    return {
      compromissos30Dias: pendentes.reduce((acc, a) => acc + (a.valor - a.valorPago), 0),
      qtdCompromissos30Dias: pendentes.length,
    };
  }, [agendamentos]);

  // ── Contraparte simétrica: quanto se espera RECEBER nos mesmos 30 dias — sem isso, o
  // "Caixa Livre" só olhava o lado de fora do dinheiro, nunca o que também está entrando.
  const { receitaEsperada30Dias, qtdReceitaEsperada30Dias } = useMemo(() => {
    const hojeZero = new Date(); hojeZero.setHours(0, 0, 0, 0);
    const limite = new Date(hojeZero); limite.setDate(hojeZero.getDate() + 30);
    const pendentes = agendamentos.filter(a => {
      if (a.tipo !== "receber") return false;
      if (statusAgendamento(a) === "pago") return false;
      if (!a.dataVencimento) return true;
      const venc = new Date(a.dataVencimento + "T00:00:00");
      return venc <= limite;
    });
    return {
      receitaEsperada30Dias: pendentes.reduce((acc, a) => acc + (a.valor - a.valorPago), 0),
      qtdReceitaEsperada30Dias: pendentes.length,
    };
  }, [agendamentos]);

  const caixaLivre = saldoConsolidado - compromissos30Dias;
  const caixaProjetado30Dias = saldoConsolidado + receitaEsperada30Dias - compromissos30Dias;

  // ── Indicadores estruturais do ano (aluguel/receita, despesas/receita etc.) — mesma
  // leitura já usada na aba DRE (IndicadoresBar.tsx); aqui viram chips discretos, não
  // cards grandes de alerta, pra não competir visualmente com a saúde operacional real.
  const indicadoresAno = useMemo(() => computeIndicadoresDre(dreLinhas), [dreLinhas]);
  const despesasTotal = indicadoresAno.margemContribuicao - indicadoresAno.resultadoOperacional;
  const pctDespesas = indicadoresAno.receitaTotal > 0 ? (despesasTotal / indicadoresAno.receitaTotal) * 100 : 0;

  // Contas a receber vencidas — sinal de inadimplência, ajuda a explicar por que o
  // caixa não bate com o que "deveria" ter entrado.
  const { vencidosReceber, qtdVencidosReceber } = useMemo(() => {
    const vencidos = agendamentos.filter(a => a.tipo === "receber" && statusAgendamento(a) === "vencido");
    return {
      vencidosReceber: vencidos.reduce((acc, a) => acc + (a.valor - a.valorPago), 0),
      qtdVencidosReceber: vencidos.length,
    };
  }, [agendamentos]);

  // Dias de Caixa (runway): quantos dias o Caixa Livre atual sustenta, no ritmo médio
  // de despesa observado neste ano até hoje — mesma lógica de reserva de segurança.
  const diasDeCaixa = useMemo(() => {
    const inicioAno = new Date(hoje.getFullYear(), 0, 1);
    const diasDecorridos = Math.max(1, Math.round((hoje.getTime() - inicioAno.getTime()) / 86400000) + 1);
    const despesaMediaDiaria = despesasTotal / diasDecorridos;
    return despesaMediaDiaria > 0 ? caixaLivre / despesaMediaDiaria : 0;
  }, [despesasTotal, caixaLivre]);

  // Nota de qualidade de dado: uma linha de despesa cujo nome remete a "cartão" com valor
  // relevante no ano — provável fatura que caiu sem detalhar o que foi comprado de fato.
  const notaCartao = useMemo(() => {
    return dreLinhas.find(l => isDreLinhaDetalhe(l.resultado) && l.resultado.toLowerCase().includes("cart") && l.totalAno > 1000) ?? null;
  }, [dreLinhas]);

  const proximosVencimentos = useMemo(() => {
    return agendamentos
      .map(a => ({ ...a, status: statusAgendamento(a) }))
      .filter(a => a.status !== "pago" && a.dataVencimento)
      .sort((a, b) => a.dataVencimento!.localeCompare(b.dataVencimento!))
      .slice(0, 8);
  }, [agendamentos]);

  // ── Tendência: faturamento real (Performance) dos últimos meses + margem operacional
  // (DRE) sobreposta — uma única série de receita (a mais granular/real) em vez de plotar
  // DRE e Performance juntos como se fossem o mesmo número (a diferença entre os dois já
  // é explicada à parte no card de reconciliação).
  const tendenciaMensal = useMemo(() => {
    const porMes = new Map<string, number>();
    perfData.forEach(d => {
      const chave = getMesAno(d.data);
      if (chave && chave !== "Geral") porMes.set(chave, (porMes.get(chave) || 0) + d.valorBruto);
    });
    const chaves = Array.from(porMes.keys()).sort((a, b) => {
      const [ma, ya] = a.split("/").map(Number);
      const [mb, yb] = b.split("/").map(Number);
      return (ya * 12 + ma) - (yb * 12 + mb);
    }).slice(-9);

    return chaves.map(chave => {
      const [m, y] = chave.split("/").map(Number);
      const idx = m - 1;
      const margem = y === anoDre ? (() => {
        const receitaCampo = valorLinhaMes(dreLinhas, "RECEITAS OPERACIONAIS", idx);
        const resultadoCampo = valorLinhaMes(dreLinhas, "RESULTADO OPERACIONAL", idx);
        return receitaCampo > 0 ? (resultadoCampo / receitaCampo) * 100 : null;
      })() : null;
      return { name: `${MESES_ABREV[idx]}/${String(y).slice(2)}`, Faturamento: porMes.get(chave) || 0, Margem: margem };
    });
  }, [perfData, dreLinhas, anoDre]);

  if (loading) {
    return <div className="card" style={{ textAlign: "center", padding: "2rem", color: "var(--color-muted)" }}>Carregando...</div>;
  }

  const margemAno = indicadoresAno.margemOperacional;
  const saudeChip = margemAno >= 15
    ? { label: "Operação saudável", cls: "badge-success", Icon: TrendingUp }
    : margemAno >= 0
    ? { label: "Margem apertada", cls: "badge-warning", Icon: TrendingUp }
    : { label: "Operação no vermelho", cls: "badge-danger", Icon: TrendingDown };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── Faixa de contexto ────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
        <span style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>
          Hoje é dia {diaAtualNum} de {diasNoMesAtual} — {MESES_FULL[mesAtualIndex]}/{anoAtual}
        </span>
        <span className={`badge ${saudeChip.cls}`}>
          <saudeChip.Icon size={12} /> {saudeChip.label} · margem do ano {margemAno.toFixed(1)}%
        </span>
      </div>

      {/* ── Linha 1: Saúde Operacional ───────────────────────────────────────── */}
      <div className="divider-text">Saúde Operacional</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.5rem" }}>

        {/* Margem Operacional (ano) com mini-tendência */}
        <div className="kpi-card">
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Margem Operacional (Ano)</span>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "4px 0 0 0", color: margemAno >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
            {margemAno.toFixed(1)}%
          </h2>
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>
            {brl(indicadoresAno.resultadoOperacional)} de resultado em {anoDre}
          </span>
          {tendenciaMensal.length > 1 && (
            <div style={{ width: "100%", height: 36, marginTop: "0.5rem" }}>
              <ResponsiveContainer>
                <LineChart data={tendenciaMensal.filter(d => d.Margem !== null)}>
                  <Line type="monotone" dataKey="Margem" stroke="var(--color-gold)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Receita Real do Mês — Performance/AppBarber, com meta */}
        <div className="kpi-card">
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <DollarSign size={12} /> Receita Real do Mês ({MESES_ABREV[mesAtualIndex]})
          </span>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "4px 0 0 0", color: "var(--color-gold)" }}>
            {brl(receitaPerformanceMesAtual)}
          </h2>
          {deltaReceitaPerf !== null && (
            <span style={{ fontSize: "0.75rem", color: deltaReceitaPerf >= 0 ? "var(--color-success)" : "var(--color-danger)", display: "flex", alignItems: "center", gap: "0.2rem" }}>
              {deltaReceitaPerf >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {Math.abs(deltaReceitaPerf).toFixed(0)}% vs mesmo período do mês passado
            </span>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginTop: "0.4rem" }}>
            {editandoMeta ? (
              <input
                type="text"
                autoFocus
                value={metaInput}
                onChange={e => setMetaInput(e.target.value)}
                onFocus={e => e.target.select()}
                onBlur={salvarMeta}
                onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                placeholder="Meta em R$"
                style={{ width: "100px", fontSize: "0.75rem", padding: "2px 6px", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: "4px", color: "var(--color-cream)" }}
              />
            ) : (
              <span
                onClick={abrirEdicaoMeta}
                style={{ fontSize: "0.75rem", color: "var(--color-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem" }}
                title={meta > 0 ? "Clique para editar a meta de faturamento mensal" : "Clique para definir a meta de faturamento mensal"}
              >
                Meta: {meta > 0 ? brl(meta) : "definir"} <Pencil size={10} />
              </span>
            )}
          </div>
          {meta > 0 && (
            <div style={{ height: "5px", background: "rgba(0,0,0,0.3)", borderRadius: "3px", overflow: "hidden", marginTop: "0.5rem" }}>
              <div style={{ width: `${progressoMeta}%`, height: "100%", background: "var(--color-gold)", transition: "width 0.4s" }} />
            </div>
          )}
          <span style={{ fontSize: "0.65rem", color: "var(--color-muted)", marginTop: "0.4rem", display: "block" }}>
            Dados AppBarber (vendas reais)
          </span>
        </div>

        {/* Projeção de Resultado do Mês */}
        <div className="kpi-card">
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <Target size={12} /> Projeção de Resultado do Mês
          </span>
          {projecaoMesCorrente ? (
            <>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "4px 0 0 0", color: projecaoMesCorrente.resultadoProjetado >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
                {brl(projecaoMesCorrente.resultadoProjetado)}
              </h2>
              <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>
                Margem projetada: {projecaoMesCorrente.margemProjetada.toFixed(1)}%
              </span>
              <span style={{ fontSize: "0.68rem", color: "var(--color-muted)", marginTop: "0.4rem", display: "block", fontStyle: "italic" }}>
                Ritmo do dia {diaAtualNum} de {diasNoMesAtual} projetado pro mês inteiro — não é o fechamento real.
              </span>
            </>
          ) : (
            <span style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginTop: "0.4rem", display: "block" }}>
              DRE deste mês ainda não disponível
            </span>
          )}
        </div>
      </div>

      {/* ── Linha 2: Caixa e Compromissos ────────────────────────────────────── */}
      <div className="divider-text">Caixa e Compromissos</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.5rem" }}>
        <div className="kpi-card">
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Saldo em Caixa Hoje</span>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "4px 0 0 0", color: saldoConsolidado >= 0 ? "var(--color-cream)" : "var(--color-danger)" }}>
            {brl(saldoConsolidado)}
          </h2>
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>
            {saldoPorConta.length === 1 ? saldoPorConta[0].nome : `${saldoPorConta.length} contas somadas`}
          </span>
          {saldoPorConta.length === 1 && saldoPorConta[0].saldoReal && (
            <span style={{ fontSize: "0.65rem", color: "var(--color-success)" }}>● Saldo real (Sicoob)</span>
          )}
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <ArrowLeftRight size={14} color="var(--color-gold)" /> Fluxo de 30 dias
          </span>
          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            <div>
              <span style={{ fontSize: "0.7rem", color: "var(--color-muted)" }}>A receber</span>
              <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--color-success)" }}>{brl(receitaEsperada30Dias)}</div>
              <span style={{ fontSize: "0.68rem", color: "var(--color-muted)" }}>{qtdReceitaEsperada30Dias} conta(s)</span>
            </div>
            <div>
              <span style={{ fontSize: "0.7rem", color: "var(--color-muted)" }}>A pagar</span>
              <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--color-danger)" }}>{brl(compromissos30Dias)}</div>
              <span style={{ fontSize: "0.68rem", color: "var(--color-muted)" }}>{qtdCompromissos30Dias} conta(s)</span>
            </div>
            <div>
              <span style={{ fontSize: "0.7rem", color: "var(--color-muted)" }}>Caixa projetado (hoje + 30 dias)</span>
              <div style={{ fontSize: "1.15rem", fontWeight: 800, color: caixaProjetado30Dias >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>{brl(caixaProjetado30Dias)}</div>
            </div>
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--color-muted)", borderTop: "1px solid var(--color-border)", paddingTop: "0.6rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <AlertTriangle size={11} /> Sem nenhuma entrada nova (pior cenário): <strong style={{ color: caixaLivre >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>{brl(caixaLivre)}</strong>
          </div>
        </div>
      </div>

      {/* ── Saldo por conta bancária — só faz sentido com 2+ contas; com 1 só, é a mesma
           informação do card "Saldo em Caixa Hoje" logo acima, repetida à toa. ──────── */}
      {saldoPorConta.length > 1 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem" }}>
          {saldoPorConta.map(c => (
            <div key={c.id} className="kpi-card">
              <span style={{ fontSize: "0.75rem", color: "var(--color-muted)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <Landmark size={12} /> {c.nome}
              </span>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "4px 0 0 0", color: c.saldoAtual >= 0 ? "var(--color-cream)" : "var(--color-danger)" }}>
                {brl(c.saldoAtual)}
              </h2>
              {c.saldoReal && <span style={{ fontSize: "0.65rem", color: "var(--color-success)" }}>● Saldo real (Sicoob)</span>}
            </div>
          ))}
        </div>
      )}
      {contas.length === 0 && (
        <div className="card" style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>
          Nenhuma conta bancária cadastrada ainda — cadastre em Cadastros → Contas Bancárias.
        </div>
      )}

      {/* ── Linha 3: Cruzamento Financeiro × Performance ─────────────────────── */}
      <div className="divider-text">Financeiro × Performance</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.5rem" }}>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <Scale size={14} color="var(--color-gold)" /> Banco × Vendas Reais ({MESES_ABREV[mesAtualIndex]})
          </span>
          {dreDoMesDisponivel ? (
            <>
              <div>
                <span style={{ fontSize: "0.7rem", color: "var(--color-muted)" }}>Financeiro (DRE do mês)</span>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--color-cream)" }}>{brl(receitaMes)}</div>
              </div>
              <div>
                <span style={{ fontSize: "0.7rem", color: "var(--color-muted)" }}>Performance (vendas reais)</span>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--color-cream)" }}>{brl(receitaPerformanceMesAtual)}</div>
              </div>
              <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "0.6rem" }}>
                <span style={{ fontSize: "0.7rem", color: "var(--color-muted)" }}>Diferença</span>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--color-gold)" }}>{brl(Math.abs(receitaMes - receitaPerformanceMesAtual))}</div>
                <p style={{ fontSize: "0.68rem", color: "var(--color-muted)", marginTop: "0.3rem" }}>
                  Normal: leva alguns dias entre a venda ser registrada no Performance e o valor
                  compensar de fato no banco (cartão, PIX agendado, etc.).
                </p>
              </div>
            </>
          ) : (
            <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>DRE deste mês ainda não disponível.</span>
          )}

          {/* Conciliação dia a dia (AppBarber x Banco, exclui dinheiro) — pega anomalia de
              categorização (ex: um aporte contado como venda) que a comparação só-do-total
              acima não detecta sozinha. */}
          {conciliacaoFaturamento && (
            <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "0.6rem" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--color-muted)" }}>Conciliação do mês (AppBarber x Banco, sem dinheiro)</span>
              {conciliacaoFaturamento.statusMes === "revisar" ? (
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.2rem" }}>
                  <AlertTriangle size={14} color="var(--color-danger)" />
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--color-danger)" }}>
                    Fora do esperado — vale revisar
                  </span>
                </div>
              ) : (
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--color-success)", marginTop: "0.2rem" }}>
                  Dentro do esperado ✓
                </div>
              )}
              {onAbrirFaturamento && (
                <button type="button" onClick={onAbrirFaturamento} className="btn btn-ghost btn-sm" style={{ marginTop: "0.4rem", padding: "0.25rem 0.5rem", fontSize: "0.72rem" }}>
                  Ver dia a dia →
                </button>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <ArrowUpRight size={18} color="var(--color-gold)" /> Faturamento Real × Margem Operacional
          </h3>
          {tendenciaMensal.length === 0 ? (
            <p style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>Nenhum dado de performance importado ainda.</p>
          ) : (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <ComposedChart data={tendenciaMensal} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d1f20" vertical={false} />
                  <XAxis dataKey="name" stroke="#7a6060" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" stroke="#7a6060" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `R$${Math.round(v / 1000)}k`} />
                  <YAxis yAxisId="right" orientation="right" stroke="#7a6060" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip
                    contentStyle={{ background: "rgba(22,15,16,0.9)", border: "1px solid var(--color-border)", borderRadius: "8px" }}
                    formatter={(v: any, name: any) => name === "Margem" ? `${Number(v).toFixed(1)}%` : brl(Number(v))}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="Faturamento" fill="#d4af8c" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" dataKey="Margem" stroke="#2ecc71" strokeWidth={3} dot={{ fill: "#2ecc71", r: 3 }} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Linha 4: Insights & Atenção ───────────────────────────────────────── */}
      <div className="divider-text">Insights & Atenção</div>
      <div className="card">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <InsightChip
            icon={AlertTriangle} label="Vencidos a Receber" value={brl(vencidosReceber)}
            sub={`${qtdVencidosReceber} conta${qtdVencidosReceber !== 1 ? "s" : ""} vencida${qtdVencidosReceber !== 1 ? "s" : ""}`}
            tone={vencidosReceber > 0 ? "danger" : "success"}
          />
          <InsightChip
            icon={diasDeCaixa < 15 ? BatteryWarning : Wallet} label="Dias de Caixa (pior cenário)"
            value={diasDeCaixa === 0 ? "—" : diasDeCaixa < 0 ? `${Math.ceil(diasDeCaixa)} dias` : `${Math.floor(diasDeCaixa)} dias`}
            sub={diasDeCaixa < 0 ? "Compromissos já superam o caixa" : "No ritmo de despesa deste ano"}
            tone={diasDeCaixa < 0 ? "danger" : diasDeCaixa < 15 ? "warning" : "success"}
          />
          <InsightChip
            icon={Home} label="Aluguel / Receita (ano)" value={`${indicadoresAno.pctAluguel.toFixed(1)}%`}
            sub={brl(indicadoresAno.aluguelTotal)}
            tone={indicadoresAno.pctAluguel > 10 ? "warning" : "muted"}
          />
          <InsightChip
            icon={Percent} label="Despesas Op. / Receita (ano)" value={`${pctDespesas.toFixed(1)}%`}
            sub={brl(despesasTotal)}
            tone={pctDespesas > 40 ? "warning" : "muted"}
          />
          {notaCartao && (
            <InsightChip
              icon={Info} label="A esclarecer" value={brl(notaCartao.totalAno)}
              sub={`${notaCartao.resultado} — fatura sem detalhar as compras`}
              tone="info"
            />
          )}
        </div>
      </div>

      {/* ── Linha 5: Próximos Vencimentos ─────────────────────────────────────── */}
      <div className="card">
        <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Calendar size={18} color="var(--color-gold)" /> Próximos Vencimentos
        </h3>
        {proximosVencimentos.length === 0 ? (
          <p style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>Nenhum vencimento em aberto.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0.6rem" }}>
            {proximosVencimentos.map(a => {
              const status = statusAgendamento(a);
              const cor = STATUS_COLORS[status];
              const Icone = a.tipo === "pagar" ? ArrowDownRight : ArrowUpRight;
              return (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", borderBottom: "1px solid var(--color-border)", paddingBottom: "0.5rem" }}>
                  <div>
                    <Icone size={12} color={cor} style={{ display: "inline", marginRight: 4 }} />
                    <span style={{ color: "var(--color-cream-dim)" }}>{a.descricao}</span>
                    <div style={{ color: "var(--color-muted)", fontSize: "0.7rem" }}>
                      {fmtData(a.dataVencimento)} · <span style={{ color: cor }}>{STATUS_LABELS[status]}</span>
                    </div>
                  </div>
                  <strong style={{ color: cor }}>
                    {brl(a.valor - a.valorPago)}
                  </strong>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
