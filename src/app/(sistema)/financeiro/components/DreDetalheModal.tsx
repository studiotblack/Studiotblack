"use client";

import { useState, useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";

interface DreDetalheAlvo {
  codigo: string;
  nome: string;
  mes: number;
  ano: number;
  mesLabel: string;
  valorDre: number;
}

interface LancamentoDetalhe {
  id: string;
  tipo: "pagar" | "receber";
  valor: number;
  valorPago: number;
  dataCompetencia: string;
  dataVencimento: string | null;
  descricao: string;
  contatoNome: string;
  categoriaNome: string;
  contaBancariaNome?: string;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d: string | null | undefined) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";

interface DadosDetalhe {
  lancamentos: LancamentoDetalhe[];
  totalNoSistema: number;
}

export default function DreDetalheModal({ alvo, onClose }: { alvo: DreDetalheAlvo | null; onClose: () => void }) {
  // null = ainda carregando (ou nenhuma consulta feita pro alvo atual)
  const [dados, setDados] = useState<DadosDetalhe | null>(null);

  useEffect(() => {
    if (!alvo) return;
    let cancelado = false;
    fetch(`/api/financeiro/dre/detalhe?codigo=${encodeURIComponent(alvo.codigo)}&mes=${alvo.mes}&ano=${alvo.ano}`)
      .then(r => r.ok ? r.json() : { lancamentos: [], totalNoSistema: 0 })
      .then(data => {
        if (!cancelado) setDados({ lancamentos: data.lancamentos || [], totalNoSistema: data.totalNoSistema || 0 });
      });
    return () => { cancelado = true; };
  }, [alvo]);

  if (!alvo) return null;

  const loading = dados === null;
  const lancamentos = dados?.lancamentos ?? [];
  const totalNoSistema = dados?.totalNoSistema ?? 0;
  const diferenca = Math.abs(alvo.valorDre - totalNoSistema);
  const reconcilia = diferenca < 0.01;

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 640 }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0 }}>{alvo.nome}</h2>
            <span style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>{alvo.mesLabel}/{alvo.ano}</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "70vh", overflowY: "auto" }}>
          <div style={{ display: "flex", gap: "1.5rem" }}>
            <div>
              <span style={{ fontSize: "0.7rem", color: "var(--color-muted)", textTransform: "uppercase" }}>No DRE (Realizado)</span>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-gold)" }}>{brl(alvo.valorDre)}</div>
            </div>
            <div>
              <span style={{ fontSize: "0.7rem", color: "var(--color-muted)", textTransform: "uppercase" }}>No sistema (Contas a Pagar/Receber)</span>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: reconcilia ? "var(--color-success)" : "var(--color-warning)" }}>{brl(totalNoSistema)}</div>
            </div>
          </div>

          {!reconcilia && !loading && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", background: "rgba(243,156,18,0.08)", border: "1px solid var(--color-warning)", borderRadius: "0.5rem", padding: "0.65rem 0.85rem", fontSize: "0.8rem", color: "var(--color-cream-dim)" }}>
              <AlertTriangle size={15} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                O valor do DRE vem do relatório importado do contador; o valor &quot;no sistema&quot; é só o que já passou por aqui
                (Sicoob sincronizado ou lançado manualmente). A diferença de {brl(diferenca)} é lançamento que ainda não está
                registrado no sistema pra esse período — não é um erro.
              </span>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-muted)" }}>Carregando...</div>
          ) : lancamentos.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-muted)", fontSize: "0.85rem" }}>
              Nenhum lançamento registrado no sistema pra essa categoria nesse mês ainda.
            </div>
          ) : (
            <table className="data-table" style={{ fontSize: "0.82rem" }}>
              <thead>
                <tr><th>Data</th><th>Contato</th><th>Descrição</th><th>Conta</th><th style={{ textAlign: "right" }}>Valor</th></tr>
              </thead>
              <tbody>
                {lancamentos.map(l => (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtData(l.dataCompetencia)}</td>
                    <td>{l.contatoNome}</td>
                    <td style={{ color: "var(--color-cream-dim)" }}>{l.descricao}</td>
                    <td style={{ color: "var(--color-muted)" }}>{l.contaBancariaNome || "—"}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: l.tipo === "receber" ? "var(--color-success)" : "var(--color-danger)" }}>
                      {l.tipo === "receber" ? "+" : "-"}{brl(l.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
