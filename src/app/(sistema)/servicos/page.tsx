"use client";

import { useState } from "react";
import { servicos } from "@/lib/mock-data";
import { Plus, Clock, DollarSign, Award, X, Edit, Trash2 } from "lucide-react";

export default function ServicosPage() {
  const [servicosList, setServicosList] = useState(servicos);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("Corte");
  const [preco, setPreco] = useState(40);
  const [duracao, setDuracao] = useState(30);
  const [comissaoPercent, setComissaoPercent] = useState(40);
  const [descricao, setDescricao] = useState("");

  const handleAddServico = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome) return;

    const newServ = {
      id: `s-${Date.now()}`,
      nome,
      categoria,
      preco: Number(preco),
      duracao: Number(duracao),
      comissaoPercent: Number(comissaoPercent),
      ativo: true,
      totalRealizado: 0,
    };

    setServicosList([...servicosList, newServ]);
    setShowAddModal(false);

    // reset
    setNome("");
    setDescricao("");
    setPreco(40);
    setDuracao(30);
    setComissaoPercent(40);
  };

  const handleToggleActive = (id: string) => {
    setServicosList(servicosList.map(s => {
      if (s.id === id) {
        return { ...s, ativo: !s.ativo };
      }
      return s;
    }));
  };

  return (
    <div className="page-container animate-fadeIn">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title text-glow-gold">Serviços Oferecidos</h1>
          <p className="page-subtitle">Cadastre os serviços prestados, tempos de duração e porcentagem de comissão</p>
        </div>
        <button className="btn btn-gold" onClick={() => setShowAddModal(true)}>
          <Plus size={16} />
          <span>Cadastrar Serviço</span>
        </button>
      </div>

      {/* Services Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.5rem" }}>
        {servicosList.map((serv) => (
          <div key={serv.id} className="card-gold" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "1.25rem", opacity: serv.ativo ? 1 : 0.6 }}>
            <div>
              <div style={{ display: "flex", justifyItems: "center", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <span className="badge badge-purple" style={{ fontSize: "0.65rem" }}>{serv.categoria}</span>
                <span className={`badge ${serv.ativo ? "badge-success" : "badge-muted"}`}>
                  {serv.ativo ? "Ativo" : "Inativo"}
                </span>
              </div>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 600, margin: "0 0 0.5rem 0", color: "var(--color-cream)" }}>
                {serv.nome}
              </h3>
              <p style={{ fontSize: "0.75rem", color: "var(--color-muted)", margin: 0 }}>
                Total realizados: <strong>{serv.totalRealizado} atendimentos</strong>
              </p>
            </div>

            {/* Price / Time info */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", borderTop: "1px solid var(--color-border)", paddingTop: "0.75rem", borderBottom: "1px solid var(--color-border)", paddingBottom: "0.75rem" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "0.65rem", color: "var(--color-muted)", textTransform: "uppercase" }}>Preço Final</span>
                <span style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--color-gold-bright)" }}>
                  R$ {serv.preco.toFixed(2)}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "0.65rem", color: "var(--color-muted)", textTransform: "uppercase" }}>Duração</span>
                <span style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--color-cream)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <Clock size={16} className="text-gold-dim" />
                  {serv.duracao} min
                </span>
              </div>
            </div>

            {/* Commission info */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8125rem" }}>
              <span style={{ color: "var(--color-cream-dim)" }}>
                Comissão Barbeiro: <strong>{serv.comissaoPercent}%</strong>
              </span>
              <span style={{ color: "var(--color-success)", fontWeight: 600 }}>
                R$ {(serv.preco * (serv.comissaoPercent / 100)).toFixed(2)}
              </span>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
              <button
                className="btn btn-ghost btn-sm"
                style={{ flex: 1 }}
                onClick={() => handleToggleActive(serv.id)}
              >
                {serv.ativo ? "Desativar" : "Ativar"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL: NOVO SERVICO */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 500 }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)", display: "flex", justifyItems: "center", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>Cadastrar Serviço</h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddServico} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div>
                <label className="form-label">Nome do Serviço</label>
                <input
                  type="text"
                  placeholder="Ex: Degradê Platinado"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label className="form-label">Categoria</label>
                  <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                    <option value="Corte">Corte</option>
                    <option value="Barba">Barba</option>
                    <option value="Combo">Combo</option>
                    <option value="Tratamento">Tratamento</option>
                    <option value="Estética">Estética</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Duração (Minutos)</label>
                  <input
                    type="number"
                    value={duracao}
                    onChange={(e) => setDuracao(Number(e.target.value))}
                    min={5}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label className="form-label">Preço (R$)</label>
                  <input
                    type="number"
                    value={preco}
                    onChange={(e) => setPreco(Number(e.target.value))}
                    min={0}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Comissão Barbeiro (%)</label>
                  <input
                    type="number"
                    value={comissaoPercent}
                    onChange={(e) => setComissaoPercent(Number(e.target.value))}
                    min={0}
                    max={100}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Descrição</label>
                <textarea
                  placeholder="Breve descrição dos produtos utilizados e diferenciais deste serviço..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={2}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-gold">Salvar Serviço</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
