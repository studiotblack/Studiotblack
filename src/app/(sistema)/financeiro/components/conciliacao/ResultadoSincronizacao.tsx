"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d?: string | null) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "sem vencimento";

interface DetalheLinha {
  data?: string;
  dataEnvio?: string;
  descricao?: string;
  legenda?: string;
  valor: number | null;
  tipo?: "entrada" | "saida";
  status: string;
  categoria?: string | null;
  contato?: string | null;
}

// ── Resultado da última sincronização — UM card só, substituindo o que antes eram 3
// componentes separados (chips de "visão geral", resumo em texto, e a lista linha-a-linha
// sempre aberta). Fechado por padrão: "X novo · Y resolvido sozinho · Z esperando você",
// com um toggle pra ver o detalhe transação a transação só quando precisar conferir.
export default function ResultadoSincronizacao({ sicoob, whatsapp, detalhesSicoob, detalhesWhatsapp, detalhesRegraSaida }: {
  sicoob: any;
  whatsapp: any;
  detalhesSicoob: DetalheLinha[];
  detalhesWhatsapp: DetalheLinha[];
  detalhesRegraSaida: DetalheLinha[];
}) {
  const [verDetalhe, setVerDetalhe] = useState(false);

  if (!sicoob && !whatsapp) return null;

  const novos = (sicoob?.novos || 0) + (whatsapp?.novos || 0);
  const resolvidos = (sicoob?.autoConciliados || 0) + (whatsapp?.vinculados || 0) + (whatsapp?.cartaoRegistrado || 0);
  const atencao = whatsapp?.semCorrespondencia || 0;
  const pausado = !!whatsapp?.pausadoPorTempo;
  const temDetalhe = detalhesSicoob.length > 0 || detalhesWhatsapp.length > 0 || detalhesRegraSaida.length > 0;

  if (novos === 0 && resolvidos === 0 && atencao === 0 && !pausado) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.7rem 1rem", borderRadius: "0.5rem", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-muted)", fontSize: "0.85rem" }}>
        <CheckCircle2 size={16} /> Tudo em dia — nenhuma novidade desde a última sincronização.
      </div>
    );
  }

  const corStatus = (status: string) => {
    if (status.startsWith("conciliado") || status === "vinculado") return "var(--color-success)";
    if (status === "pendente") return "var(--color-muted)";
    return "var(--color-danger)";
  };

  return (
    <div className="card" style={{ padding: "0.85rem 1.1rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.85rem", color: "var(--color-cream)" }}>
          <strong style={{ color: "var(--color-gold)" }}>{novos}</strong> novo{novos === 1 ? "" : "s"} ·{" "}
          <strong style={{ color: "var(--color-success)" }}>{resolvidos}</strong> resolvido{resolvidos === 1 ? "" : "s"} sozinho{resolvidos === 1 ? "" : "s"}
          {atencao > 0 && (
            <> · <strong style={{ color: "var(--color-danger)" }}>{atencao}</strong> esperando você</>
          )}
        </span>
        {pausado && (
          <span
            title="O OCR ou o pareamento de comprovantes demorou demais e a sincronização parou de propósito antes do limite de tempo — o que sobrou continua pendente e será retomado na próxima sincronização."
            style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}
          >
            (parte ficou pra próxima sincronização — tempo esgotado)
          </span>
        )}
        {temDetalhe && (
          <button type="button" onClick={() => setVerDetalhe(v => !v)} className="btn btn-ghost btn-sm" style={{ marginLeft: "auto", color: "var(--color-muted)" }}>
            {verDetalhe ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {verDetalhe ? "Esconder detalhe" : "Ver linha a linha"}
          </button>
        )}
      </div>

      {verDetalhe && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", borderTop: "1px solid var(--color-border)", paddingTop: "0.75rem" }}>
          {detalhesSicoob.length > 0 && (
            <div>
              <h4 style={{ fontSize: "0.72rem", color: "var(--color-muted)", textTransform: "uppercase", fontWeight: 800, marginBottom: "0.4rem" }}>
                Extrato Sicoob — {detalhesSicoob.length} transaç{detalhesSicoob.length === 1 ? "ão" : "ões"}
              </h4>
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                {detalhesSicoob.map((d, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.3rem 0", borderBottom: "1px solid var(--color-border)", fontSize: "0.76rem" }}>
                    <span style={{ color: "var(--color-muted)", width: 78, flexShrink: 0 }}>{fmtData(d.data)}</span>
                    <span style={{ flex: 1, color: "var(--color-cream)" }}>
                      {d.descricao}
                      {d.categoria && <span style={{ color: "var(--color-gold)" }}> · {d.categoria}</span>}
                    </span>
                    <span style={{ width: 90, textAlign: "right", color: d.tipo === "entrada" ? "var(--color-success)" : "var(--color-danger)" }}>
                      {d.tipo === "entrada" ? "+" : "-"}{brl(d.valor || 0)}
                    </span>
                    <span style={{ width: 190, textAlign: "right", color: corStatus(d.status), fontSize: "0.7rem" }}>{d.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {detalhesWhatsapp.length > 0 && (
            <div>
              <h4 style={{ fontSize: "0.72rem", color: "var(--color-muted)", textTransform: "uppercase", fontWeight: 800, marginBottom: "0.4rem" }}>
                Comprovantes WhatsApp — {detalhesWhatsapp.length} processado{detalhesWhatsapp.length === 1 ? "" : "s"}
              </h4>
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                {detalhesWhatsapp.map((d, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.3rem 0", borderBottom: "1px solid var(--color-border)", fontSize: "0.76rem" }}>
                    <span style={{ color: "var(--color-muted)", width: 130, flexShrink: 0 }}>{d.dataEnvio ? new Date(d.dataEnvio).toLocaleString("pt-BR") : ""}</span>
                    <span style={{ flex: 1, color: "var(--color-cream)" }}>
                      {d.legenda || <em style={{ color: "var(--color-muted)" }}>sem legenda</em>}
                      {d.categoria && <span style={{ color: "var(--color-gold)" }}> · {d.categoria}</span>}
                      {d.contato && <span style={{ color: "var(--color-muted)" }}> ({d.contato})</span>}
                    </span>
                    <span style={{ width: 90, textAlign: "right" }}>{d.valor !== null ? brl(d.valor) : "—"}</span>
                    <span style={{ width: 230, textAlign: "right", color: corStatus(d.status), fontSize: "0.7rem" }}>{d.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {detalhesRegraSaida.length > 0 && (
            <div>
              <h4 style={{ fontSize: "0.72rem", color: "var(--color-muted)", textTransform: "uppercase", fontWeight: 800, marginBottom: "0.4rem" }}>
                Regras aprendidas aplicadas — {detalhesRegraSaida.length} conciliada{detalhesRegraSaida.length === 1 ? "" : "s"}
              </h4>
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                {detalhesRegraSaida.map((d, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.3rem 0", borderBottom: "1px solid var(--color-border)", fontSize: "0.76rem" }}>
                    <span style={{ color: "var(--color-muted)", width: 78, flexShrink: 0 }}>{fmtData(d.data)}</span>
                    <span style={{ flex: 1, color: "var(--color-cream)" }}>
                      {d.descricao} <span style={{ color: "var(--color-muted)" }}>({d.contato})</span>
                      {d.categoria && <span style={{ color: "var(--color-gold)" }}> · {d.categoria}</span>}
                    </span>
                    <span style={{ width: 90, textAlign: "right", color: "var(--color-danger)" }}>-{brl(d.valor || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
