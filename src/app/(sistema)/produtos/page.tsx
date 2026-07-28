"use client";

import { useState } from "react";
import { produtos } from "@/lib/mock-data";
import { Plus, Minus, ArrowUp, ArrowDown, Package, Edit, X, Search, ShieldAlert } from "lucide-react";

export default function ProdutosPage() {
  const [productList, setProductList] = useState(produtos);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<typeof produtos[0] | null>(null);

  // Add product form
  const [nome, setNome] = useState("");
  const [marca, setMarca] = useState("");
  const [categoria, setCategoria] = useState("Styling");
  const [precoCompra, setPrecoCompra] = useState(15);
  const [precoVenda, setPrecoVenda] = useState(40);
  const [estoqueAtual, setEstoqueAtual] = useState(10);
  const [estoqueMinimo, setEstoqueMinimo] = useState(5);
  const [unidade, setUnidade] = useState("un");

  // Adjust stock form
  const [adjustQty, setAdjustQty] = useState(1);
  const [adjustType, setAdjustType] = useState("ENTRADA"); // ENTRADA | SAIDA
  const [adjustReason, setAdjustReason] = useState("");

  const filteredProducts = productList.filter(p => 
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.marca && p.marca.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome) return;

    const newProd = {
      id: `p-${Date.now()}`,
      nome,
      marca,
      categoria,
      precoCompra: Number(precoCompra),
      precoVenda: Number(precoVenda),
      estoqueAtual: Number(estoqueAtual),
      estoqueMinimo: Number(estoqueMinimo),
      unidade,
    };

    setProductList([newProd, ...productList]);
    setShowAddModal(false);

    // reset
    setNome("");
    setMarca("");
    setPrecoCompra(15);
    setPrecoVenda(40);
    setEstoqueAtual(10);
    setEstoqueMinimo(5);
  };

  const handleOpenAdjust = (prod: typeof produtos[0]) => {
    setSelectedProduct(prod);
    setAdjustQty(1);
    setAdjustType("ENTRADA");
    setAdjustReason("");
    setShowAdjustModal(true);
  };

  const handleAdjustStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const qtyChange = adjustType === "ENTRADA" ? adjustQty : -adjustQty;

    setProductList(productList.map(p => {
      if (p.id === selectedProduct.id) {
        return {
          ...p,
          estoqueAtual: Math.max(0, p.estoqueAtual + qtyChange)
        };
      }
      return p;
    }));

    setShowAdjustModal(false);
    setSelectedProduct(null);
  };

  return (
    <div className="page-container animate-fadeIn">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title text-glow-gold">Estoque e Produtos</h1>
          <p className="page-subtitle">Controle de inventário de produtos para revenda e uso interno na barbearia</p>
        </div>
        <button className="btn btn-gold" onClick={() => setShowAddModal(true)}>
          <Plus size={16} />
          <span>Novo Produto</span>
        </button>
      </div>

      {/* Stats Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem", marginBottom: "1.5rem" }}>
        <div className="kpi-card" style={{ padding: "1.25rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Total de Itens em Estoque</span>
          <h3 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "4px 0 0 0" }}>
            {productList.reduce((acc, curr) => acc + curr.estoqueAtual, 0)} un
          </h3>
        </div>
        <div className="kpi-card" style={{ padding: "1.25rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Valor do Estoque (Custo)</span>
          <h3 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "4px 0 0 0", color: "var(--color-gold)" }}>
            {productList.reduce((acc, curr) => acc + (curr.estoqueAtual * curr.precoCompra), 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </h3>
        </div>
        <div className="kpi-card" style={{ padding: "1.25rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Valor Estimado de Venda</span>
          <h3 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "4px 0 0 0", color: "var(--color-success)" }}>
            {productList.reduce((acc, curr) => acc + (curr.estoqueAtual * curr.precoVenda), 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </h3>
        </div>
        <div className="kpi-card" style={{ padding: "1.25rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Itens com Estoque Baixo</span>
          <h3 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "4px 0 0 0", color: "var(--color-danger)" }}>
            {productList.filter(p => p.estoqueAtual <= p.estoqueMinimo).length} itens
          </h3>
        </div>
      </div>

      {/* Filter / Search */}
      <div className="card" style={{ padding: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ position: "relative", maxWidth: 400 }}>
          <Search size={18} color="var(--color-muted)" style={{ position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            placeholder="Pesquisar por nome do produto ou marca..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: "2.5rem" }}
          />
        </div>
      </div>

      {/* Products Table */}
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Produto / SKU</th>
              <th>Categoria</th>
              <th>Preço Custo</th>
              <th>Preço Venda</th>
              <th style={{ textAlign: "center" }}>Quantidade</th>
              <th>Status Estoque</th>
              <th style={{ textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((prod) => {
              const isLow = prod.estoqueAtual <= prod.estoqueMinimo;
              return (
                <tr key={prod.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <div className="avatar avatar-md" style={{ background: "rgba(212,175,140,0.15)", borderRadius: "8px" }}>
                        <Package size={18} color="var(--color-gold)" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--color-cream)" }}>{prod.nome}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Marca: {prod.marca || "Própria"}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-purple">{prod.categoria}</span>
                  </td>
                  <td>R$ {prod.precoCompra.toFixed(2)}</td>
                  <td>{prod.precoVenda > 0 ? `R$ ${prod.precoVenda.toFixed(2)}` : <span style={{ color: "var(--color-muted)" }}>Uso Interno</span>}</td>
                  <td style={{ textAlign: "center", fontWeight: 700 }}>
                    {prod.estoqueAtual} {prod.unidade}
                  </td>
                  <td>
                    {isLow ? (
                      <span className="badge badge-danger" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                        <ShieldAlert size={12} />
                        Estoque Baixo
                      </span>
                    ) : (
                      <span className="badge badge-success">Suficiente</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleOpenAdjust(prod)}>
                      Ajustar Estoque
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "3rem", color: "var(--color-muted)" }}>
                  Nenhum produto cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: NOVO PRODUTO */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 500 }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)", display: "flex", justifyItems: "center", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>Novo Produto</h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddProduct} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div>
                <label className="form-label">Nome do Produto</label>
                <input
                  type="text"
                  placeholder="Ex: Pomada Efeito Matte"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label className="form-label">Marca</label>
                  <input
                    type="text"
                    placeholder="Ex: Barber Pro"
                    value={marca}
                    onChange={(e) => setMarca(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Categoria</label>
                  <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                    <option value="Styling">Styling / Finalização</option>
                    <option value="Shampoo">Shampoo & Condicionador</option>
                    <option value="Barba">Cuidados com Barba</option>
                    <option value="Higiene">Higiene & Limpeza</option>
                    <option value="Tratamento">Tratamento Capilar</option>
                    <option value="Descartável">Material Descartável</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label className="form-label">Preço de Custo (Compra)</label>
                  <input
                    type="number"
                    value={precoCompra}
                    onChange={(e) => setPrecoCompra(Number(e.target.value))}
                    min={0}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Preço de Venda</label>
                  <input
                    type="number"
                    value={precoVenda}
                    onChange={(e) => setPrecoVenda(Number(e.target.value))}
                    min={0}
                    placeholder="Deixe 0 se for uso interno"
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                <div>
                  <label className="form-label">Estoque Inicial</label>
                  <input
                    type="number"
                    value={estoqueAtual}
                    onChange={(e) => setEstoqueAtual(Number(e.target.value))}
                    min={0}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Alerta de Mínimo</label>
                  <input
                    type="number"
                    value={estoqueMinimo}
                    onChange={(e) => setEstoqueMinimo(Number(e.target.value))}
                    min={0}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Unidade</label>
                  <select value={unidade} onChange={(e) => setUnidade(e.target.value)}>
                    <option value="un">Unidade (un)</option>
                    <option value="ml">Mililitro (ml)</option>
                    <option value="g">Grama (g)</option>
                    <option value="litro">Litro (L)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-gold">Salvar Produto</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AJUSTE DE ESTOQUE */}
      {showAdjustModal && selectedProduct && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 450 }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)", display: "flex", justifyItems: "center", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>Ajustar Inventário</h2>
              <button onClick={() => { setShowAdjustModal(false); setSelectedProduct(null); }} style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAdjustStock} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ background: "var(--color-surface-2)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--color-border)" }}>
                <div style={{ fontWeight: 600, color: "var(--color-cream)" }}>{selectedProduct.nome}</div>
                <div style={{ fontSize: "0.8125rem", color: "var(--color-muted)" }}>
                  Estoque atual registrado: <strong style={{ color: "var(--color-gold)" }}>{selectedProduct.estoqueAtual} {selectedProduct.unidade}</strong>
                </div>
              </div>

              <div>
                <label className="form-label">Tipo de Movimento</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setAdjustType("ENTRADA")}
                    style={{
                      background: adjustType === "ENTRADA" ? "var(--color-success-dim)" : "var(--color-surface-3)",
                      color: adjustType === "ENTRADA" ? "var(--color-success)" : "var(--color-muted)",
                      border: adjustType === "ENTRADA" ? "1px solid var(--color-success)" : "1px solid var(--color-border)"
                    }}
                  >
                    <ArrowUp size={16} />
                    <span>Entrada / Compra</span>
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setAdjustType("SAIDA")}
                    style={{
                      background: adjustType === "SAIDA" ? "var(--color-danger-dim)" : "var(--color-surface-3)",
                      color: adjustType === "SAIDA" ? "var(--color-danger)" : "var(--color-muted)",
                      border: adjustType === "SAIDA" ? "1px solid var(--color-danger)" : "1px solid var(--color-border)"
                    }}
                  >
                    <ArrowDown size={16} />
                    <span>Saída / Uso / Ajuste</span>
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem" }}>
                <div>
                  <label className="form-label">Quantidade</label>
                  <input
                    type="number"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(Math.max(1, Number(e.target.value)))}
                    min={1}
                    required
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: "0.875rem", color: "var(--color-muted)", paddingBottom: "10px" }}>{selectedProduct.unidade}</span>
                </div>
              </div>

              <div>
                <label className="form-label">Motivação / Justificativa</label>
                <input
                  type="text"
                  placeholder="Ex: Compra de lote do fornecedor ou Descarte por vencimento"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button type="button" className="btn btn-ghost" onClick={() => { setShowAdjustModal(false); setSelectedProduct(null); }}>Cancelar</button>
                <button type="submit" className="btn btn-gold">Confirmar Ajuste</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
