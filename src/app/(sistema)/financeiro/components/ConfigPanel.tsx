"use client";

import { Settings, FolderTree, ListTree, Info } from "lucide-react";
import type { DreLinhaImportada } from "@/lib/dre-data";
import { isDreLinhaDetalhe } from "@/lib/dre-data";

interface ConfigPanelProps {
  linhas: DreLinhaImportada[];
  ano: number;
}

export default function ConfigPanel({ linhas, ano }: ConfigPanelProps) {
  const grupos = linhas.filter(l => !isDreLinhaDetalhe(l.resultado) && l.resultado.trim() !== "%");
  const contas = linhas.filter(l => isDreLinhaDetalhe(l.resultado));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Settings color="var(--color-gold)" size={24} />
          Estrutura do DRE
        </h2>
        <p style={{ color: "var(--color-muted)", fontSize: "0.9rem", marginTop: "0.25rem" }}>
          A estrutura vem do seu próprio plano de contas (cadastrado em Categorias) e dos lançamentos já registrados — não há categorias pra configurar manualmente aqui.
        </p>
      </div>

      <div className="card" style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", background: "rgba(52,152,219,0.06)", borderColor: "rgba(52,152,219,0.25)" }}>
        <Info size={18} color="var(--color-info)" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: "0.85rem", color: "var(--color-cream-dim)", margin: 0, lineHeight: 1.6 }}>
          Esses números vêm do Sicoob (via nossa própria conciliação bancária), não mais de um Excel importado do Nibo —
          se uma categoria nova for criada em Cadastros, ela aparece aqui assim que tiver algum lançamento.
        </p>
      </div>

      {linhas.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem 2rem", color: "var(--color-muted)" }}>
          Nenhum DRE importado ainda para {ano}.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
          <div className="card">
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--color-gold)" }}>
              <FolderTree size={16} /> Grupos e Totais ({grupos.length})
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: 360, overflowY: "auto" }}>
              {grupos.map((g, i) => (
                <div key={i} style={{ fontSize: "0.8rem", color: "var(--color-cream-dim)", padding: "0.35rem 0.5rem", borderRadius: "0.375rem", background: "var(--color-surface-2)" }}>
                  {g.resultado}
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--color-gold)" }}>
              <ListTree size={16} /> Contas de Detalhe ({contas.length})
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: 360, overflowY: "auto" }}>
              {contas.map((c, i) => (
                <div key={i} style={{ fontSize: "0.78rem", color: "var(--color-muted)", padding: "0.3rem 0.5rem" }}>
                  {c.resultado}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
