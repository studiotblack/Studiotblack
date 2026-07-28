"use client";

import { useState } from "react";
import { Settings, Plus, Trash2, Edit2, Save, X } from "lucide-react";
import type { DREGrupo, CategoriasConfig } from "@/lib/dre-data";
import { CATEGORIAS_DEFAULT, GRUPO_LABELS } from "@/lib/dre-data";

export default function ConfigPanel() {
  // Inicializamos com o default. Na vida real, isso viria de uma API/BD.
  const [config, setConfig] = useState<CategoriasConfig>(CATEGORIAS_DEFAULT);
  
  const [activeGroup, setActiveGroup] = useState<DREGrupo>("receita");
  const [editingSub, setEditingSub] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState("");
  
  const [newSubSubName, setNewSubSubName] = useState("");
  const [addingToSub, setAddingToSub] = useState<string | null>(null);

  const addSubcategoria = () => {
    if (!newSubName.trim()) return;
    setConfig(prev => ({
      ...prev,
      [activeGroup]: {
        ...prev[activeGroup],
        [newSubName.trim()]: []
      }
    }));
    setNewSubName("");
  };

  const removeSubcategoria = (sub: string) => {
    if (!confirm(`Remover categoria "${sub}" e todas as suas subcategorias?`)) return;
    setConfig(prev => {
      const copy = { ...prev };
      const groupCopy = { ...copy[activeGroup] };
      delete groupCopy[sub];
      copy[activeGroup] = groupCopy;
      return copy;
    });
  };

  const addSubSubcategoria = (sub: string) => {
    if (!newSubSubName.trim()) return;
    setConfig(prev => {
      const copy = { ...prev };
      copy[activeGroup] = {
        ...copy[activeGroup],
        [sub]: [...(copy[activeGroup][sub] || []), newSubSubName.trim()]
      };
      return copy;
    });
    setNewSubSubName("");
    setAddingToSub(null);
  };

  const removeSubSubcategoria = (sub: string, subsub: string) => {
    setConfig(prev => {
      const copy = { ...prev };
      copy[activeGroup] = {
        ...copy[activeGroup],
        [sub]: copy[activeGroup][sub].filter(s => s !== subsub)
      };
      return copy;
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Settings color="var(--color-gold)" size={24} />
          Configuração da DRE
        </h2>
        <p style={{ color: "var(--color-muted)", fontSize: "0.9rem", marginTop: "0.25rem" }}>
          Gerencie as categorias e subcategorias (3 níveis) da sua Demonstração de Resultado.
        </p>
      </div>

      <div style={{ display: "flex", gap: "2rem", alignItems: "flex-start", flexWrap: "wrap" }}>
        
        {/* Menu Lateral de Grupos */}
        <div style={{ width: "250px", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {(["receita", "custo", "despesa", "investimento", "financiamento"] as DREGrupo[]).map(g => (
            <button
              key={g}
              onClick={() => setActiveGroup(g)}
              style={{
                padding: "1rem", borderRadius: "0.75rem", textAlign: "left",
                fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", transition: "all 0.2s",
                background: activeGroup === g ? "var(--color-gold)" : "var(--color-surface-2)",
                color: activeGroup === g ? "var(--color-bg)" : "var(--color-cream)",
                border: "none"
              }}
            >
              {GRUPO_LABELS[g]}
            </button>
          ))}
        </div>

        {/* Área Principal de Edição */}
        <div style={{ flex: 1, minWidth: "300px", background: "var(--color-surface)", padding: "2rem", borderRadius: "1rem", border: "1px solid var(--color-border)" }}>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: "1.5rem", color: "var(--color-gold)" }}>
            Categorias de {GRUPO_LABELS[activeGroup]}
          </h3>

          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem" }}>
            <input 
              type="text" 
              placeholder="Nova Categoria..."
              value={newSubName}
              onChange={e => setNewSubName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addSubcategoria()}
              style={{ flex: 1, padding: "0.75rem 1rem", borderRadius: "0.5rem", background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "white" }}
            />
            <button className="btn btn-gold" onClick={addSubcategoria} style={{ padding: "0 1rem" }}>
              <Plus size={18} /> Adicionar
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {Object.keys(config[activeGroup]).map(sub => (
              <div key={sub} style={{ background: "var(--color-surface-2)", borderRadius: "0.75rem", border: "1px solid var(--color-border)", overflow: "hidden" }}>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", background: "rgba(0,0,0,0.2)" }}>
                  <span style={{ fontWeight: 800, fontSize: "1rem" }}>{sub}</span>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button onClick={() => setAddingToSub(addingToSub === sub ? null : sub)} style={{ background: "none", border: "none", color: "var(--color-success)", cursor: "pointer", padding: "0.25rem" }} title="Adicionar Detalhe">
                      <Plus size={16} />
                    </button>
                    <button onClick={() => removeSubcategoria(sub)} style={{ background: "none", border: "none", color: "var(--color-danger)", cursor: "pointer", padding: "0.25rem" }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div style={{ padding: "1rem" }}>
                  {config[activeGroup][sub].length === 0 ? (
                    <p style={{ color: "var(--color-muted)", fontSize: "0.85rem", fontStyle: "italic" }}>Sem detalhes adicionais</p>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      {config[activeGroup][sub].map(subsub => (
                        <div key={subsub} style={{ background: "var(--color-bg)", padding: "0.25rem 0.75rem", borderRadius: "1rem", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.5rem", border: "1px solid var(--color-border)" }}>
                          {subsub}
                          <button onClick={() => removeSubSubcategoria(sub, subsub)} style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer", padding: 0, display: "flex" }}>
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {addingToSub === sub && (
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                      <input 
                        type="text" 
                        placeholder="Novo Detalhe..."
                        value={newSubSubName}
                        onChange={e => setNewSubSubName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && addSubSubcategoria(sub)}
                        style={{ flex: 1, padding: "0.5rem 0.75rem", borderRadius: "0.5rem", background: "var(--color-bg)", border: "1px dashed var(--color-border)", color: "white", fontSize: "0.85rem" }}
                        autoFocus
                      />
                      <button className="btn btn-ghost" onClick={() => addSubSubcategoria(sub)} style={{ padding: "0.5rem" }}>Salvar</button>
                    </div>
                  )}
                </div>

              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
