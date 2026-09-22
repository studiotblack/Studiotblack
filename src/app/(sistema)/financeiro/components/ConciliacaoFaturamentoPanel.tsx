"use client";

import { useState, useEffect, useMemo } from "react";
import { X, AlertTriangle } from "lucide-react";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface DiaConciliacao {
  dia: number;
  appBarber: number;
  banco: number;
  diferenca: number;
  destaque: boolean;
}

interface RespostaConciliacao {
  mesAno: string;
  dias: DiaConciliacao[];
  totalAppBarber: number;
  totalBanco: number;
  totalDinheiro: number;
  statusMes: "ok" | "revisar";
  temPagamentoDesconhecido: boolean;
}

interface LancamentoDetalhe {
  id: string;
  tipo: "pagar" | "receber";
  valor: number;
  dataCompetencia: string;
  descricao: string;
  contatoNome: string;
  categoriaNome: string;
  contaBancariaNome?: string;
}

const fmtData = (d: string | null | undefined) => (d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—");

// Mês atual, no formato MM/YYYY já usado no resto do módulo Performance/Financeiro.
function mesAnoAtual(): string {
  const hoje = new Date();
  return `${String(hoje.getMonth() + 1).padStart(2, "0")}/${hoje.getFullYear()}`;
}

export default function ConciliacaoFaturamentoPanel() {
  const [mesAno, setMesAno] = useState(mesAnoAtual());
  const [dados, setDados] = useState<RespostaConciliacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [diaDetalhe, setDiaDetalhe] = useState<number | null>(null);
  const [lancamentosDetalhe, setLancamentosDetalhe] = useState<LancamentoDetalhe[] | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/financeiro/conciliacao-faturamento?mesAno=${encodeURIComponent(mesAno)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setDados)
      .finally(() => setLoading(false));
  }, [mesAno]);

  useEffect(() => {
    if (diaDetalhe == null) { setLancamentosDetalhe(null); return; }
    let cancelado = false;
    fetch(`/api/financeiro/conciliacao-faturamento/detalhe?dia=${diaDetalhe}&mesAno=${encodeURIComponent(mesAno)}`)
      .then((r) => (r.ok ? r.json() : { lancamentos: [] }))
      .then((data) => { if (!cancelado) setLancamentosDetalhe(data.lancamentos || []); });
    return () => { cancelado = true; };
  }, [diaDetalhe, mesAno]);

  // <input type="month"> trabalha em "YYYY-MM" — converte pros dois formatos.
  const inputMonthValue = useMemo(() => {
    const [mes, ano] = mesAno.split("/");
    return `${ano}-${mes}`;
  }, [mesAno]);
  const handleMesChange = (valor: string) => {
    const [ano, mes] = valor.split("-");
    if (ano && mes) setMesAno(`${mes}/${ano}`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Faturamento: AppBarber x Banco</h2>
          <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", margin: "4px 0 0 0" }}>
            Compara o que foi vendido no AppBarber com o que efetivamente caiu no Sicoob como venda — dia a dia.
          </p>
        </div>
        <input type="month" value={inputMonthValue} onChange={(e) => handleMesChange(e.target.value)} style={{ width: "auto" }} />
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-muted)" }}>Carregando...</div>
      ) : !dados ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-muted)" }}>Não foi possível carregar.</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
            <div className="kpi-card">
              <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>AppBarber (sem dinheiro)</span>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "4px 0 0 0" }}>{brl(dados.totalAppBarber)}</h2>
            </div>
            <div className="kpi-card">
              <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Banco (Venda de Serviços)</span>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "4px 0 0 0" }}>{brl(dados.totalBanco)}</h2>
            </div>
            <div className="kpi-card">
              <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Diferença no mês</span>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "4px 0 0 0", color: dados.statusMes === "ok" ? "var(--color-success)" : "var(--color-danger)" }}>
                {brl(dados.totalBanco - dados.totalAppBarber)}
              </h2>
              <span style={{ fontSize: "0.7rem", color: "var(--color-muted)" }}>{dados.statusMes === "ok" ? "Dentro do esperado" : "Fora do esperado"}</span>
            </div>
            <div className="kpi-card">
              <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Vendido em dinheiro (fora da comparação)</span>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "4px 0 0 0", color: "var(--color-muted)" }}>{brl(dados.totalDinheiro)}</h2>
            </div>
          </div>

          {dados.temPagamentoDesconhecido && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", background: "rgba(243,156,18,0.08)", border: "1px solid var(--color-warning)", borderRadius: "0.5rem", padding: "0.65rem 0.85rem", fontSize: "0.8rem", color: "var(--color-cream-dim)" }}>
              <AlertTriangle size={15} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                Tem venda desse mês sem o método de pagamento identificado (importada antes da correção) — ela entrou na
                comparação como se não fosse dinheiro, o que pode gerar diferença falsa em alguns dias.
              </span>
            </div>
          )}

          <p style={{ fontSize: "0.75rem", color: "var(--color-muted)", margin: 0 }}>
            Diferença dia a dia é esperada — o cartão leva de 1 a alguns dias pra compensar no banco, então a venda de
            hoje só aparece na coluna Banco daqui a pouco. Clique em qualquer dia pra ver os lançamentos por trás do
            valor; dias com <strong style={{ color: "var(--color-danger)" }}>destaque</strong> têm diferença grande
            o bastante pra valer a pena olhar primeiro.
          </p>

          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Dia</th>
                  <th style={{ textAlign: "right" }}>AppBarber</th>
                  <th style={{ textAlign: "right" }}>Banco</th>
                  <th style={{ textAlign: "right" }}>Diferença</th>
                </tr>
              </thead>
              <tbody>
                {dados.dias.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: "center", padding: "2rem", color: "var(--color-muted)" }}>Nenhum dado pra esse mês.</td></tr>
                ) : dados.dias.map((d) => (
                  <tr key={d.dia} onClick={() => setDiaDetalhe(d.dia)} style={{ cursor: "pointer" }}>
                    <td>
                      {String(d.dia).padStart(2, "0")}/{mesAno}
                      {d.destaque && (
                        <span className="badge" style={{ marginLeft: "0.5rem", background: "rgba(231,76,60,0.12)", color: "var(--color-danger)", border: "1px solid var(--color-danger)", display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.68rem" }}>
                          <AlertTriangle size={10} /> Destaque
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>{brl(d.appBarber)}</td>
                    <td style={{ textAlign: "right" }}>{brl(d.banco)}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: d.destaque ? "var(--color-danger)" : "var(--color-cream-dim)" }}>
                      {brl(d.diferenca)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {diaDetalhe != null && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 640 }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0 }}>Lançamentos do dia {String(diaDetalhe).padStart(2, "0")}/{mesAno}</h2>
              <button onClick={() => setDiaDetalhe(null)} style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer" }}><X size={20} /></button>
            </div>
            <div style={{ padding: "1.5rem", maxHeight: "60vh", overflowY: "auto" }}>
              {lancamentosDetalhe === null ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-muted)" }}>Carregando...</div>
              ) : lancamentosDetalhe.length === 0 ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-muted)", fontSize: "0.85rem" }}>
                  Nenhum lançamento encontrado pra esse dia — a diferença pode ser uma venda do AppBarber que ainda não caiu no banco.
                </div>
              ) : (
                <table className="data-table" style={{ fontSize: "0.82rem" }}>
                  <thead>
                    <tr><th>Contato</th><th>Descrição</th><th>Conta</th><th style={{ textAlign: "right" }}>Valor</th></tr>
                  </thead>
                  <tbody>
                    {lancamentosDetalhe.map((l) => (
                      <tr key={l.id}>
                        <td>{l.contatoNome}</td>
                        <td style={{ color: "var(--color-cream-dim)" }}>{l.descricao}</td>
                        <td style={{ color: "var(--color-muted)" }}>{l.contaBancariaNome || "—"}</td>
                        <td style={{ textAlign: "right", fontWeight: 600, color: "var(--color-success)" }}>+{brl(l.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginTop: "1rem" }}>
                Achou uma entrada que não é venda de verdade? Corrija a categoria dela em Conciliação Bancária ou Contas a Pagar/Receber.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
