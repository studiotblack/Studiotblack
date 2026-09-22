"use client";

import { useState, useEffect } from "react";
import { MessageCircle } from "lucide-react";
import type { CategoriaFinanceira, TransacaoBancariaImportada } from "@/lib/financeiro-data";
import { extrairContraparte } from "@/lib/financeiro-data";
import CategoriaCombobox from "../CategoriaCombobox";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ITENS_POR_PAGINA = 10;

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

// ── Linha de uma transação já conciliada. Quando veio de um match automático do WhatsApp
// sem categoria reconhecida, dá pra abrir e escolher a categoria na mão — e "lembrar esse
// padrão bancário" (a contraparte do Pix, não a legenda da foto, que muda a cada envio) pra
// da próxima vez que aparecer um pagamento pro MESMO lugar já vir com contato e categoria
// certos sozinho, com ou sem foto nova no WhatsApp.
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

export default function ListaConciliadas({ conciliadas, categorias, onSalvo, onCategoriaCriada }: {
  conciliadas: TransacaoBancariaImportada[];
  categorias: CategoriaFinanceira[];
  onSalvo: () => void;
  onCategoriaCriada: (nova: CategoriaFinanceira) => void;
}) {
  const [pagina, setPagina] = useState(1);
  useEffect(() => { setPagina(1); }, [conciliadas.length]);

  if (conciliadas.length === 0) return null;

  const totalPaginas = Math.max(1, Math.ceil(conciliadas.length / ITENS_POR_PAGINA));
  const paginaAtual = conciliadas.slice((pagina - 1) * ITENS_POR_PAGINA, pagina * ITENS_POR_PAGINA);

  return (
    <div className="card">
      <h4 style={{ fontSize: "0.8rem", color: "var(--color-muted)", textTransform: "uppercase", fontWeight: 800, marginBottom: "0.75rem" }}>
        Conciliadas ({conciliadas.length})
      </h4>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        {paginaAtual.map(tx => (
          <ConciliadaRow key={tx.id} tx={tx} categorias={categorias} onSalvo={onSalvo} onCategoriaCriada={onCategoriaCriada} />
        ))}
      </div>
      <Paginador pagina={pagina} totalPaginas={totalPaginas} onMudar={setPagina} />
    </div>
  );
}
