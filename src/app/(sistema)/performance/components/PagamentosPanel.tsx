"use client";

import { useState, useEffect, useCallback } from "react";
import { Wallet, Loader2, Trophy } from "lucide-react";

interface PagamentoInfo {
  nome: string;
  contatoId: string;
  comissaoServicos: number;
  comissaoProdutos: number;
  total: number;
  meta: {
    metaServicos: number;
    metaProdutos: number;
    bonusServicos: number;
    bonusProdutos: number;
    bateuServicos: boolean;
    bateuProdutos: boolean;
    bateuTotal: boolean;
  } | null;
  financeiro: {
    comissao: { valor: number; valorPago: number };
    bonus: { valor: number; valorPago: number } | null;
  };
}

const formatMoeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const mesAtual = () => {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

function BarraPagamento({ valor, valorPago }: { valor: number; valorPago: number }) {
  const pct = valor > 0 ? Math.min(100, (valorPago / valor) * 100) : 0;
  const restante = Math.max(0, valor - valorPago);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "0.25rem", color: "var(--color-cream-dim)" }}>
        <span>Pago: {formatMoeda(valorPago)}</span>
        <span>Restante: {formatMoeda(restante)}</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: "var(--color-surface-2)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: pct >= 100 ? "var(--color-success, #2ecc71)" : "var(--color-gold)", transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

export default function PagamentosPanel() {
  const [mesAno, setMesAno] = useState(mesAtual());
  const [dados, setDados] = useState<PagamentoInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/performance/pagamentos?mesAno=${encodeURIComponent(mesAno)}`);
      if (res.ok) setDados(await res.json());
    } finally {
      setLoading(false);
    }
  }, [mesAno]);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <Wallet color="var(--color-gold)" size={24} />
            <div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Pagamentos da Equipe</h3>
              <p style={{ color: "var(--color-muted)", fontSize: "0.85rem", margin: 0 }}>
                Comissão de serviços, produtos e metas — status de pagamento sincronizado com o Financeiro.
              </p>
            </div>
          </div>
          <input
            type="month"
            value={`${mesAno.split("/")[1]}-${mesAno.split("/")[0]}`}
            onChange={e => {
              const [ano, mes] = e.target.value.split("-");
              setMesAno(`${mes}/${ano}`);
            }}
            style={{ background: "var(--color-surface-2)", padding: "0.5rem", borderRadius: "0.5rem", border: "1px solid var(--color-border)", color: "var(--color-cream)" }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
          <Loader2 size={28} className="animate-spin" style={{ color: "var(--color-muted)" }} />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1.25rem" }}>
          {dados.map(p => (
            <div key={p.contatoId} className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 style={{ margin: 0, fontSize: "1.05rem" }}>{p.nome}</h4>
                {p.meta?.bateuTotal && (
                  <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "var(--color-success, #2ecc71)", fontSize: "0.8rem", fontWeight: 600 }}>
                    <Trophy size={14} /> Meta batida
                  </span>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: "0.85rem" }}>
                <div>
                  <div style={{ color: "var(--color-muted)" }}>Comissão Serviços</div>
                  <div style={{ fontWeight: 600 }}>{formatMoeda(p.comissaoServicos)}</div>
                  {p.meta && p.meta.metaServicos > 0 && (
                    <div style={{ fontSize: "0.75rem", color: p.meta.bateuServicos ? "var(--color-success, #2ecc71)" : "var(--color-muted)" }}>
                      Meta: {formatMoeda(p.meta.metaServicos)} {p.meta.bateuServicos ? `— bônus ${formatMoeda(p.meta.bonusServicos)}` : ""}
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ color: "var(--color-muted)" }}>Comissão Produtos</div>
                  <div style={{ fontWeight: 600 }}>{formatMoeda(p.comissaoProdutos)}</div>
                  {p.meta && p.meta.metaProdutos > 0 && (
                    <div style={{ fontSize: "0.75rem", color: p.meta.bateuProdutos ? "var(--color-success, #2ecc71)" : "var(--color-muted)" }}>
                      Meta: {formatMoeda(p.meta.metaProdutos)} {p.meta.bateuProdutos ? `— bônus ${formatMoeda(p.meta.bonusProdutos)}` : ""}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                  <span>Total calculado</span>
                  <span style={{ color: "var(--color-gold)" }}>{formatMoeda(p.total)}</span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.8rem", color: "var(--color-cream-dim)", marginBottom: "0.35rem" }}>Lançamento de comissão no Financeiro</div>
                {p.financeiro.comissao.valor > 0 ? (
                  <BarraPagamento valor={p.financeiro.comissao.valor} valorPago={p.financeiro.comissao.valorPago} />
                ) : (
                  <div style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>Sem lançamento criado neste mês.</div>
                )}
              </div>

              {p.financeiro.bonus && (
                <div>
                  <div style={{ fontSize: "0.8rem", color: "var(--color-cream-dim)", marginBottom: "0.35rem" }}>Bônus de meta batida (pago separado)</div>
                  <BarraPagamento valor={p.financeiro.bonus.valor} valorPago={p.financeiro.bonus.valorPago} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
