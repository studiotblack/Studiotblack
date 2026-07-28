"use client";

import { useState } from "react";
import { clientes } from "@/lib/mock-data";
import { Search, Plus, Phone, Mail, Award, Calendar, DollarSign, X } from "lucide-react";

export default function ClientesPage() {
  const [clientList, setClientList] = useState(clientes);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // New Client Form States
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [servicoFavorito, setServicoFavorito] = useState("Corte + Barba");
  const [observacoes, setObservacoes] = useState("");

  const filteredClients = clientList.filter(c => 
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.telefone && c.telefone.includes(searchTerm))
  );

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome) return;

    const newClient = {
      id: `cl-${Date.now()}`,
      nome,
      telefone,
      email,
      totalVisitas: 0,
      ultimaVisita: "Novo Cliente",
      totalGasto: 0,
      servicoFavorito,
      observacoes
    };

    setClientList([newClient, ...clientList]);
    setShowAddModal(false);
    
    // Clear forms
    setNome("");
    setTelefone("");
    setEmail("");
    setObservacoes("");
  };

  return (
    <div className="page-container animate-fadeIn">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title text-glow-gold">Gestão de Clientes</h1>
          <p className="page-subtitle">Histórico de frequência, gastos e preferências dos clientes</p>
        </div>
        <button className="btn btn-gold" onClick={() => setShowAddModal(true)}>
          <Plus size={16} />
          <span>Cadastrar Cliente</span>
        </button>
      </div>

      {/* Filter / Search bar */}
      <div className="card" style={{ padding: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ position: "relative", maxWidth: 400 }}>
          <Search size={18} color="var(--color-muted)" style={{ position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            placeholder="Pesquisar por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: "2.5rem" }}
          />
        </div>
      </div>

      {/* Clients Table */}
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Contato</th>
              <th>Serviço Favorito</th>
              <th style={{ textAlign: "center" }}>Total Visitas</th>
              <th style={{ textAlign: "right" }}>Total Gasto</th>
              <th>Última Visita</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map((client) => (
              <tr key={client.id}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div className="avatar avatar-md" style={{ background: "linear-gradient(135deg, var(--color-gold-dark), var(--color-gold-dim))" }}>
                      {client.nome.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--color-cream)" }}>{client.nome}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>ID: {client.id}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.8125rem" }}>
                    {client.telefone && (
                      <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        <Phone size={12} className="text-gold-dim" />
                        {client.telefone}
                      </span>
                    )}
                    {client.email && (
                      <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        <Mail size={12} className="text-muted" />
                        {client.email}
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <span className="badge badge-gold" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                    <Award size={12} />
                    {client.servicoFavorito}
                  </span>
                </td>
                <td style={{ textAlign: "center", fontWeight: 600 }}>{client.totalVisitas}</td>
                <td style={{ textAlign: "right", fontWeight: 700, color: "var(--color-gold-bright)" }}>
                  {client.totalGasto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </td>
                <td style={{ fontSize: "0.8125rem" }}>
                  {client.ultimaVisita !== "Novo Cliente" ? (
                    new Date(client.ultimaVisita).toLocaleDateString("pt-BR")
                  ) : (
                    <span className="badge badge-success">Novo</span>
                  )}
                </td>
              </tr>
            ))}
            {filteredClients.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "3rem", color: "var(--color-muted)" }}>
                  Nenhum cliente encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: CADASTRO DE CLIENTE */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 500 }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)", display: "flex", justifyItems: "center", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>Cadastrar Cliente</h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddClient} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div>
                <label className="form-label">Nome Completo</label>
                <input
                  type="text"
                  placeholder="Ex: André Silva"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label className="form-label">Telefone / WhatsApp</label>
                  <input
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">E-mail</label>
                  <input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Preferência de Serviço</label>
                <select value={servicoFavorito} onChange={(e) => setServicoFavorito(e.target.value)}>
                  <option value="Corte Simples">Corte Simples</option>
                  <option value="Corte Degradê">Corte Degradê</option>
                  <option value="Corte + Barba">Corte + Barba</option>
                  <option value="Corte + Barba + Hidratação">Corte + Barba + Hidratação</option>
                  <option value="Barba Completa">Barba Completa</option>
                </select>
              </div>

              <div>
                <label className="form-label">Observações / Detalhes de Atendimento</label>
                <textarea
                  placeholder="Ex: Cabelo rebelde nas laterais, prefere degradê navalhado, café sem açúcar."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={3}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-gold">Salvar Cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
