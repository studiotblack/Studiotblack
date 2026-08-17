"use client";

import { useState } from "react";
import { UploadCloud, CheckCircle2, ArrowRightLeft, FileText, Bot, Receipt, Link as LinkIcon, PlusCircle, Search, X } from "lucide-react";
import clsx from "clsx";
import type { BankTransaction, DRELancamento, DREGrupo } from "@/lib/dre-data";
import { CATEGORIAS_DEFAULT, mockBankTransactions } from "@/lib/dre-data";

interface ConciliacaoPanelProps {
  onSync: (mes: number, ano: number) => Promise<void>;
  isSyncing: boolean;
  lancamentos: DRELancamento[];
  onConciliar: (bankTx: BankTransaction, newDRELancamento: Partial<DRELancamento>) => void;
}

export default function ConciliacaoPanel({ onSync, isSyncing, lancamentos, onConciliar }: ConciliacaoPanelProps) {
  const [bankData, setBankData] = useState<BankTransaction[]>([]);
  const [mes, setMes] = useState(6);
  const [ano, setAno] = useState(2026);
  const [hasSyncedLocal, setHasSyncedLocal] = useState(false);

  // Modal de conciliação
  const [resolveTx, setResolveTx] = useState<BankTransaction | null>(null);
  const [grupo, setGrupo] = useState<DREGrupo>("despesa");
  const [subcategoria, setSubcategoria] = useState("");
  const [subsubcategoria, setSubsubcategoria] = useState("");

  const handleSyncClick = async () => {
    await onSync(mes, ano);
    // Simula que a API retornou dados bancários e nós os carregamos
    setBankData(mockBankTransactions);
    setHasSyncedLocal(true);
  };

  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtDate = (d: string) => d.split("-").reverse().join("/");

  const handleGrupoChange = (g: DREGrupo) => {
    setGrupo(g);
    const firstSub = Object.keys(CATEGORIAS_DEFAULT[g])[0];
    setSubcategoria(firstSub);
    setSubsubcategoria(CATEGORIAS_DEFAULT[g][firstSub]?.[0] || "");
  };

  const handleSubChange = (s: string) => {
    setSubcategoria(s);
    setSubsubcategoria(CATEGORIAS_DEFAULT[grupo][s]?.[0] || "");
  };

  const handleConciliarClick = (tx: BankTransaction) => {
    // Autoselect grupo baseado no tipo (C = receita, D = despesa)
    const initialGrupo: DREGrupo = tx.tipo === "C" ? "receita" : "despesa";
    setResolveTx(tx);
    handleGrupoChange(initialGrupo);
  };

  const confirmarConciliacao = () => {
    if (!resolveTx) return;

    onConciliar(resolveTx, {
      data: resolveTx.data,
      descricao: resolveTx.descricao,
      valor: Math.abs(resolveTx.valor),
      tipo: resolveTx.tipo === "C" ? "ENTRADA" : "SAIDA",
      grupo,
      subcategoria,
      subsubcategoria: subsubcategoria || undefined,
      origem: "banco",
      importadoSicoob: true,
    });

    // Atualiza o status localmente para sumir da lista
    setBankData(prev => prev.map(t => t.id === resolveTx.id ? { ...t, status: "conciliado" } : t));
    setResolveTx(null);
  };

  const pendingBankData = bankData.filter(t => t.status === "pendente");
  const conciliatedBankData = bankData.filter(t => t.status === "conciliado");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      
      {/* HEADER E CONTROLES */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <ArrowRightLeft color="var(--color-gold)" size={24} />
            Conciliação Bancária
          </h2>
          <p style={{ color: "var(--color-muted)", fontSize: "0.9rem", marginTop: "0.25rem" }}>
            Conecte seu banco e categorize os lançamentos na DRE automaticamente.
          </p>
        </div>

        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <select 
            value={mes} onChange={e => setMes(Number(e.target.value))}
            style={{ padding: "0.5rem 1rem", borderRadius: "0.5rem", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-cream)" }}
          >
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
              <option key={m} value={m}>Mês {m}</option>
            ))}
          </select>
          <select 
            value={ano} onChange={e => setAno(Number(e.target.value))}
            style={{ padding: "0.5rem 1rem", borderRadius: "0.5rem", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-cream)" }}
          >
            {[2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          <button 
            className="btn btn-gold" 
            onClick={handleSyncClick}
            disabled={isSyncing}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <Bot size={18} />
            {isSyncing ? "Sincronizando..." : "Sincronizar Extrato"}
          </button>
        </div>
      </div>

      {/* PAINEL VAZIO */}
      {!hasSyncedLocal && (
        <div style={{ padding: "4rem 2rem", textAlign: "center", background: "var(--color-surface)", borderRadius: "1rem", border: "1px dashed var(--color-border)" }}>
          <ArrowRightLeft size={48} color="var(--color-muted-2)" style={{ margin: "0 auto 1rem auto" }} />
          <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-cream)", marginBottom: "0.5rem" }}>Nenhum dado importado</h3>
          <p style={{ color: "var(--color-muted)" }}>Clique em "Sincronizar Extrato" para buscar as movimentações do Sicoob.</p>
        </div>
      )}

      {/* LISTA DE CONCILIAÇÃO */}
      {hasSyncedLocal && (
        <div style={{ background: "var(--color-surface)", borderRadius: "1rem", border: "1px solid var(--color-border)", overflow: "hidden" }}>
          <div style={{ display: "flex", padding: "1rem", borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-2)", color: "var(--color-muted)", fontSize: "0.8rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
             <div style={{ flex: 1 }}>Extrato Bancário</div>
             <div style={{ width: "200px", textAlign: "right", paddingRight: "2rem" }}>Ação DRE</div>
          </div>

          {pendingBankData.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "var(--color-success)" }}>
              <CheckCircle2 size={48} style={{ margin: "0 auto 1rem auto" }} />
              <p style={{ fontWeight: 700, fontSize: "1.1rem" }}>Tudo conciliado!</p>
              <p style={{ fontSize: "0.9rem" }}>Não há lançamentos pendentes para este mês.</p>
            </div>
          ) : (
            pendingBankData.map(tx => (
              <div key={tx.id} style={{ display: "flex", alignItems: "center", padding: "1rem", borderBottom: "1px solid var(--color-border)" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--color-cream)" }}>{tx.descricao}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>{fmtDate(tx.data)}</span>
                </div>
                <div style={{ width: "150px", textAlign: "right", fontWeight: 800, color: tx.tipo === "C" ? "var(--color-success)" : "var(--color-danger)" }}>
                  {tx.tipo === "C" ? "+" : "-"}{brl(tx.valor)}
                </div>
                <div style={{ width: "200px", display: "flex", justifyContent: "flex-end" }}>
                  <button 
                    onClick={() => handleConciliarClick(tx)}
                    style={{ background: "var(--color-gold)", color: "var(--color-bg)", border: "none", padding: "0.5rem 1rem", borderRadius: "0.5rem", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" }}
                  >
                    Categorizar
                  </button>
                </div>
              </div>
            ))
          )}

          {conciliatedBankData.length > 0 && (
            <div style={{ padding: "1rem", background: "var(--color-surface-2)", borderTop: "2px solid var(--color-border)" }}>
              <h4 style={{ fontSize: "0.8rem", color: "var(--color-muted)", textTransform: "uppercase", fontWeight: 800, marginBottom: "1rem" }}>Lançamentos já conciliados ({conciliatedBankData.length})</h4>
              {conciliatedBankData.map(tx => (
                <div key={tx.id} style={{ display: "flex", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid var(--color-border)", opacity: 0.5 }}>
                  <div style={{ flex: 1, fontSize: "0.85rem", color: "var(--color-cream)" }}>{tx.descricao}</div>
                  <div style={{ width: "100px", textAlign: "right", fontSize: "0.85rem" }}>{tx.tipo === "C" ? "+" : "-"}{brl(tx.valor)}</div>
                  <div style={{ width: "100px", textAlign: "right", fontSize: "0.8rem", color: "var(--color-success)" }}>✔ Conciliado</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL DE CONCILIAÇÃO INLINE */}
      {resolveTx && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 500 }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>Categorizar na DRE</h2>
              <button onClick={() => setResolveTx(null)} style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer" }}><X size={20} /></button>
            </div>
            
            <div style={{ padding: "1.5rem" }}>
              <div style={{ padding: "1rem", background: "var(--color-surface-2)", borderRadius: "0.5rem", marginBottom: "1.5rem" }}>
                <p style={{ fontSize: "0.75rem", color: "var(--color-muted)", textTransform: "uppercase", fontWeight: 800 }}>Banco</p>
                <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--color-cream)", marginTop: "0.25rem" }}>{resolveTx.descricao}</p>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--color-muted)" }}>{fmtDate(resolveTx.data)}</span>
                  <span style={{ fontSize: "1rem", fontWeight: 800, color: resolveTx.tipo === "C" ? "var(--color-success)" : "var(--color-danger)" }}>
                    {resolveTx.tipo === "C" ? "+" : "-"}{brl(resolveTx.valor)}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label className="form-label">Grupo DRE</label>
                  <select value={grupo} onChange={e => handleGrupoChange(e.target.value as DREGrupo)} style={{ width: "100%", padding: "0.75rem", borderRadius: "0.5rem", background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-cream)" }}>
                    <option value="receita">Receita</option>
                    <option value="custo">Custo Operacional</option>
                    <option value="despesa">Despesa Operacional</option>
                    <option value="investimento">Investimento</option>
                    <option value="financiamento">Financiamento</option>
                  </select>
                </div>
                
                <div>
                  <label className="form-label">Subcategoria</label>
                  <select value={subcategoria} onChange={e => handleSubChange(e.target.value)} style={{ width: "100%", padding: "0.75rem", borderRadius: "0.5rem", background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-cream)" }}>
                    {Object.keys(CATEGORIAS_DEFAULT[grupo]).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {CATEGORIAS_DEFAULT[grupo][subcategoria]?.length > 0 && (
                  <div>
                    <label className="form-label">Detalhe (Sub-subcategoria)</label>
                    <select value={subsubcategoria} onChange={e => setSubsubcategoria(e.target.value)} style={{ width: "100%", padding: "0.75rem", borderRadius: "0.5rem", background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-cream)" }}>
                      {CATEGORIAS_DEFAULT[grupo][subcategoria].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "2rem" }}>
                <button className="btn btn-ghost" onClick={() => setResolveTx(null)}>Cancelar</button>
                <button className="btn btn-gold" onClick={confirmarConciliacao}>Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
