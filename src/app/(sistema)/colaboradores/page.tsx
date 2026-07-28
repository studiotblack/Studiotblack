"use client";

import { useState } from "react";
import { Plus, Clock, Shield, Check, X, Edit2 } from "lucide-react";
import { useAuth, ALL_MENUS, Usuario } from "@/lib/auth-context";

export default function ColaboradoresPage() {
  const { usuarios, setUsuarios } = useAuth();
  
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);

  // Form states
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("Barbeiro");
  const [cor, setCor] = useState("#d4af8c");
  const [permissoes, setPermissoes] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const openNewModal = () => {
    setEditingUser(null);
    setNome("");
    setCargo("Barbeiro");
    setCor("#d4af8c");
    setIsAdmin(false);
    setPermissoes(["/dashboard", "/agenda"]);
    setShowModal(true);
  };

  const openEditModal = (user: Usuario) => {
    setEditingUser(user);
    setNome(user.nome);
    setCargo(user.cargo);
    setCor(user.cor);
    setIsAdmin(user.isAdmin);
    setPermissoes(user.permissoes);
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome) return;

    if (editingUser) {
      setUsuarios(prev => prev.map(u => {
        if (u.id === editingUser.id) {
          return { ...u, nome, cargo, cor, isAdmin, permissoes };
        }
        return u;
      }));
    } else {
      const newUser: Usuario = {
        id: `c-${Date.now()}`,
        nome,
        cargo,
        cor,
        isAdmin,
        permissoes
      };
      setUsuarios(prev => [...prev, newUser]);
    }

    setShowModal(false);
  };

  const togglePermission = (href: string) => {
    if (permissoes.includes(href)) {
      setPermissoes(permissoes.filter(p => p !== href));
    } else {
      setPermissoes([...permissoes, href]);
    }
  };

  return (
    <div className="page-container animate-fadeIn">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title text-glow-gold">Equipe e Colaboradores</h1>
          <p className="page-subtitle">Configure acessos, permissões e visualize a equipe</p>
        </div>
        <button className="btn btn-gold" onClick={openNewModal}>
          <Plus size={16} />
          <span>Contratar Profissional</span>
        </button>
      </div>

      {/* Grid List */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
        {usuarios.map((user) => (
          <div key={user.id} className="card-gold" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Header info */}
            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <div className="avatar avatar-lg" style={{ background: `linear-gradient(135deg, ${user.cor}, var(--color-bg))` }}>
                {user.nome.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>{user.nome}</h3>
                <span style={{ fontSize: "0.75rem", color: "var(--color-gold-dim)" }}>{user.cargo}</span>
              </div>
              {user.isAdmin && (
                <span className="badge badge-gold">
                  <Shield size={12} /> Admin
                </span>
              )}
            </div>

            {/* Access info */}
            <div style={{
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              padding: "0.75rem 1rem",
            }}>
              <span style={{ color: "var(--color-muted)", fontSize: "0.7rem", textTransform: "uppercase" }}>Acessos Liberados</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", marginTop: "0.5rem" }}>
                {user.isAdmin ? (
                  <span className="badge badge-success" style={{ fontSize: "0.65rem" }}>Acesso Total</span>
                ) : (
                  user.permissoes.map(p => {
                    const menuLabel = ALL_MENUS.find(m => m.href === p)?.label || p;
                    return (
                      <span key={p} className="badge" style={{ fontSize: "0.65rem", background: "rgba(255,255,255,0.05)", border: "1px solid var(--color-border-light)" }}>
                        {menuLabel}
                      </span>
                    );
                  })
                )}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "auto" }}>
              <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => openEditModal(user)}>
                <Edit2 size={14} /> Editar Acessos e Perfil
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL: NOVO / EDITAR COLABORADOR */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 550 }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>
                {editingUser ? "Editar Profissional" : "Cadastrar Profissional"}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div>
                <label className="form-label">Nome do Profissional</label>
                <input
                  type="text"
                  placeholder="Ex: Marcus Oliveira"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label className="form-label">Função / Especialidade</label>
                  <select value={cargo} onChange={(e) => setCargo(e.target.value)}>
                    <option value="Admin">Admin</option>
                    <option value="Gerente">Gerente</option>
                    <option value="Barbeiro Sênior">Barbeiro Sênior</option>
                    <option value="Barbeiro">Barbeiro</option>
                    <option value="Recepção">Recepção</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Cor da Agenda</label>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      type="color"
                      value={cor}
                      onChange={(e) => setCor(e.target.value)}
                      style={{ padding: 0, height: "40px", width: "40px", cursor: "pointer", border: "1px solid var(--color-border)" }}
                    />
                    <input
                      type="text"
                      value={cor}
                      onChange={(e) => setCor(e.target.value)}
                      style={{ flex: 1, textTransform: "uppercase" }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1rem", marginTop: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <label className="form-label" style={{ margin: 0, fontSize: "0.9rem", color: "var(--color-gold)" }}>Permissões de Acesso</label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                    <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
                    <span style={{ fontSize: "0.8rem", color: isAdmin ? "var(--color-success)" : "var(--color-cream-dim)" }}>
                      Acesso Total (Admin)
                    </span>
                  </label>
                </div>

                {!isAdmin && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    {ALL_MENUS.map(menu => (
                      <label key={menu.href} style={{ 
                        display: "flex", alignItems: "center", gap: "0.5rem", 
                        padding: "0.5rem", background: "var(--color-surface-2)", 
                        border: "1px solid var(--color-border)", borderRadius: "6px",
                        cursor: "pointer"
                      }}>
                        <input 
                          type="checkbox" 
                          checked={permissoes.includes(menu.href)} 
                          onChange={() => togglePermission(menu.href)}
                        />
                        <span style={{ fontSize: "0.8rem", color: "var(--color-cream)" }}>{menu.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-gold">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
