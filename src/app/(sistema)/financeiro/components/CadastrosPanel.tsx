"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Landmark, Users, FolderTree, Target, Link2, Tags } from "lucide-react";
import type { ContaBancaria, Contato, CategoriaFinanceira, CentroCusto, TipoContato } from "@/lib/financeiro-data";
import { TIPOS_CONTATO_LABELS } from "@/lib/financeiro-data";
import SicoobConfigModal from "./SicoobConfigModal";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
type SubTab = "contas" | "contatos" | "categorias" | "centros" | "palavras";

interface PalavraChave {
  id: string;
  palavraChave: string;
  categoriaId: string;
  categoriaNome: string;
}

export default function CadastrosPanel() {
  const [subTab, setSubTab] = useState<SubTab>("contas");

  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>([]);
  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [palavrasChave, setPalavrasChave] = useState<PalavraChave[]>([]);
  const [loading, setLoading] = useState(true);

  const carregarTudo = async () => {
    setLoading(true);
    try {
      const [rContas, rContatos, rCategorias, rCentros, rPalavras] = await Promise.all([
        fetch("/api/financeiro/contas-bancarias"),
        fetch("/api/financeiro/contatos"),
        fetch("/api/financeiro/categorias"),
        fetch("/api/financeiro/centros-custo"),
        fetch("/api/financeiro/palavras-chave"),
      ]);
      setContas(rContas.ok ? await rContas.json() : []);
      setContatos(rContatos.ok ? await rContatos.json() : []);
      setCategorias(rCategorias.ok ? await rCategorias.json() : []);
      setCentros(rCentros.ok ? await rCentros.json() : []);
      setPalavrasChave(rPalavras.ok ? await rPalavras.json() : []);
    } catch (err) {
      console.error("Erro ao carregar cadastros:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregarTudo(); }, []);

  const subTabs: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    { id: "contas", label: "Contas Bancárias", icon: <Landmark size={14} /> },
    { id: "contatos", label: "Contatos", icon: <Users size={14} /> },
    { id: "categorias", label: "Categorias", icon: <FolderTree size={14} /> },
    { id: "centros", label: "Centros de Custo", icon: <Target size={14} /> },
    { id: "palavras", label: "Palavras-chave", icon: <Tags size={14} /> },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {subTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={subTab === t.id ? "btn btn-gold btn-sm" : "btn btn-ghost btn-sm"}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: "center", padding: "2rem", color: "var(--color-muted)" }}>Carregando...</div>
      ) : (
        <>
          {subTab === "contas" && (
            <ContasBancariasSection
              contas={contas}
              contatos={contatos}
              categorias={categorias}
              centros={centros}
              onChange={carregarTudo}
            />
          )}
          {subTab === "contatos" && <ContatosSection contatos={contatos} onChange={carregarTudo} />}
          {subTab === "categorias" && <CategoriasSection categorias={categorias} onChange={carregarTudo} />}
          {subTab === "centros" && <CentrosCustoSection centros={centros} onChange={carregarTudo} />}
          {subTab === "palavras" && <PalavrasChaveSection palavras={palavrasChave} categorias={categorias} onChange={carregarTudo} />}
        </>
      )}
    </div>
  );
}

// ── Contas Bancárias ─────────────────────────────────────────────────────────
function ContasBancariasSection({ contas, contatos, categorias, centros, onChange }: {
  contas: ContaBancaria[];
  contatos: Contato[];
  categorias: CategoriaFinanceira[];
  centros: CentroCusto[];
  onChange: () => void;
}) {
  const [contaSicoob, setContaSicoob] = useState<ContaBancaria | null>(null);
  const [nome, setNome] = useState("");
  const [banco, setBanco] = useState("");
  const [tipoConta, setTipoConta] = useState("Conta corrente");
  const [agencia, setAgencia] = useState("");
  const [conta, setConta] = useState("");
  const [saldoInicial, setSaldoInicial] = useState(0);
  const [dataSaldoInicial, setDataSaldoInicial] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !banco) return;
    setSaving(true);
    try {
      const res = await fetch("/api/financeiro/contas-bancarias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, banco, tipoConta, agencia, conta, saldoInicial, dataSaldoInicial }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setNome(""); setBanco(""); setAgencia(""); setConta(""); setSaldoInicial(0);
      onChange();
    } catch (err: any) {
      alert(err.message || "Erro ao salvar conta bancária");
    } finally {
      setSaving(false);
    }
  };

  const excluir = async (id: string) => {
    if (!confirm("Desativar esta conta bancária?")) return;
    const res = await fetch(`/api/financeiro/contas-bancarias?id=${id}`, { method: "DELETE" });
    if (!res.ok) alert((await res.json()).error || "Erro ao excluir");
    onChange();
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) 2fr", gap: "1.5rem" }}>
      <form onSubmit={salvar} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>Nova Conta Bancária</h3>
        <input placeholder="Nome/apelido (ex: Sicoob PJ)" value={nome} onChange={e => setNome(e.target.value)} required />
        <input placeholder="Banco" value={banco} onChange={e => setBanco(e.target.value)} required />
        <select value={tipoConta} onChange={e => setTipoConta(e.target.value)}>
          <option>Conta corrente</option><option>Poupança</option><option>Caixa</option><option>Cartão</option>
        </select>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          <input placeholder="Agência" value={agencia} onChange={e => setAgencia(e.target.value)} />
          <input placeholder="Conta" value={conta} onChange={e => setConta(e.target.value)} />
        </div>
        <label className="form-label">Saldo inicial (na data de corte)</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          <input type="number" step="0.01" value={saldoInicial} onChange={e => setSaldoInicial(Number(e.target.value))} />
          <input type="date" value={dataSaldoInicial} onChange={e => setDataSaldoInicial(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-gold" disabled={saving}><Plus size={14} /> {saving ? "Salvando..." : "Adicionar Conta"}</button>
      </form>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data-table">
          <thead><tr><th>Nome</th><th>Banco</th><th>Tipo</th><th>Agência/Conta</th><th style={{ textAlign: "right" }}>Saldo Inicial</th><th>Sicoob</th><th></th></tr></thead>
          <tbody>
            {contas.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "var(--color-muted)" }}>Nenhuma conta cadastrada.</td></tr>}
            {contas.map(c => (
              <tr key={c.id} style={{ opacity: c.ativa ? 1 : 0.4 }}>
                <td style={{ fontWeight: 600 }}>{c.nome}</td>
                <td>{c.banco}</td>
                <td><span className="badge badge-muted">{c.tipoConta}</span></td>
                <td style={{ fontSize: "0.8rem" }}>{c.agencia || "—"} / {c.conta || "—"}</td>
                <td style={{ textAlign: "right" }}>{brl(c.saldoInicial)}</td>
                <td>
                  {c.sicoobClientId ? (
                    <span className="badge badge-success" style={{ fontSize: "0.65rem" }}>Conectada</span>
                  ) : (
                    <span className="badge badge-muted" style={{ fontSize: "0.65rem" }}>Não conectada</span>
                  )}
                </td>
                <td style={{ textAlign: "center", display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                  <button onClick={() => setContaSicoob(c)} title="Configurar Sicoob" style={{ background: "none", border: "none", color: "var(--color-gold)", cursor: "pointer" }}><Link2 size={14} /></button>
                  {c.ativa && <button onClick={() => excluir(c.id)} style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer" }}><Trash2 size={14} /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SicoobConfigModal
        conta={contaSicoob}
        contatos={contatos}
        categorias={categorias}
        centros={centros}
        onClose={() => setContaSicoob(null)}
        onSaved={onChange}
      />
    </div>
  );
}

// ── Contatos ─────────────────────────────────────────────────────────────────
function ContatosSection({ contatos, onChange }: { contatos: Contato[]; onChange: () => void }) {
  const [nome, setNome] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [tipos, setTipos] = useState<TipoContato[]>([]);
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleTipo = (t: TipoContato) => {
    setTipos(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || tipos.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/financeiro/contatos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, cpfCnpj, tipos, email, telefone }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setNome(""); setCpfCnpj(""); setTipos([]); setEmail(""); setTelefone("");
      onChange();
    } catch (err: any) {
      alert(err.message || "Erro ao salvar contato");
    } finally {
      setSaving(false);
    }
  };

  const excluir = async (id: string) => {
    if (!confirm("Desativar este contato?")) return;
    const res = await fetch(`/api/financeiro/contatos?id=${id}`, { method: "DELETE" });
    if (!res.ok) alert((await res.json()).error || "Erro ao excluir");
    onChange();
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) 2fr", gap: "1.5rem" }}>
      <form onSubmit={salvar} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>Novo Contato</h3>
        <input placeholder="Nome / Razão Social" value={nome} onChange={e => setNome(e.target.value)} required />
        <input placeholder="CPF/CNPJ (opcional)" value={cpfCnpj} onChange={e => setCpfCnpj(e.target.value)} />
        <div>
          <label className="form-label">Papéis (pode marcar mais de um)</label>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {(Object.keys(TIPOS_CONTATO_LABELS) as TipoContato[]).map(t => (
              <button key={t} type="button" onClick={() => toggleTipo(t)}
                className={tipos.includes(t) ? "badge badge-gold" : "badge badge-muted"}
                style={{ cursor: "pointer", border: "none" }}
              >
                {TIPOS_CONTATO_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
        <input placeholder="E-mail (opcional)" value={email} onChange={e => setEmail(e.target.value)} />
        <input placeholder="Telefone (opcional)" value={telefone} onChange={e => setTelefone(e.target.value)} />
        <button type="submit" className="btn btn-gold" disabled={saving}><Plus size={14} /> {saving ? "Salvando..." : "Adicionar Contato"}</button>
      </form>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data-table">
          <thead><tr><th>Nome</th><th>CPF/CNPJ</th><th>Papéis</th><th></th></tr></thead>
          <tbody>
            {contatos.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", padding: "2rem", color: "var(--color-muted)" }}>Nenhum contato cadastrado.</td></tr>}
            {contatos.map(c => (
              <tr key={c.id} style={{ opacity: c.ativo ? 1 : 0.4 }}>
                <td style={{ fontWeight: 600 }}>{c.nome}</td>
                <td style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>{c.cpfCnpj || "—"}</td>
                <td style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                  {c.tipos.map(t => <span key={t} className="badge badge-gold" style={{ fontSize: "0.65rem" }}>{TIPOS_CONTATO_LABELS[t]}</span>)}
                </td>
                <td style={{ textAlign: "center" }}>
                  {c.ativo && <button onClick={() => excluir(c.id)} style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer" }}><Trash2 size={14} /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Categorias ───────────────────────────────────────────────────────────────
function CategoriasSection({ categorias, onChange }: { categorias: CategoriaFinanceira[]; onChange: () => void }) {
  const [grupo, setGrupo] = useState("");
  const [categoriaPai, setCategoriaPai] = useState("");
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"entrada" | "saida">("saida");
  const [codigo, setCodigo] = useState("");
  const [saving, setSaving] = useState(false);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grupo || !nome) return;
    setSaving(true);
    try {
      const res = await fetch("/api/financeiro/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grupo, categoriaPai, nome, tipo, codigo }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setGrupo(""); setCategoriaPai(""); setNome(""); setCodigo("");
      onChange();
    } catch (err: any) {
      alert(err.message || "Erro ao salvar categoria");
    } finally {
      setSaving(false);
    }
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir esta categoria?")) return;
    const res = await fetch(`/api/financeiro/categorias?id=${id}`, { method: "DELETE" });
    if (!res.ok) alert((await res.json()).error || "Erro ao excluir");
    onChange();
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) 2fr", gap: "1.5rem" }}>
      <form onSubmit={salvar} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>Nova Categoria</h3>
        <input placeholder="Grupo (ex: DESPESAS)" value={grupo} onChange={e => setGrupo(e.target.value)} required />
        <input placeholder="Categoria pai (opcional)" value={categoriaPai} onChange={e => setCategoriaPai(e.target.value)} />
        <input placeholder="Nome da categoria" value={nome} onChange={e => setNome(e.target.value)} required />
        <input placeholder="Código (opcional)" value={codigo} onChange={e => setCodigo(e.target.value)} />
        <select value={tipo} onChange={e => setTipo(e.target.value as "entrada" | "saida")}>
          <option value="saida">Saída (despesa)</option>
          <option value="entrada">Entrada (receita)</option>
        </select>
        <button type="submit" className="btn btn-gold" disabled={saving}><Plus size={14} /> {saving ? "Salvando..." : "Adicionar Categoria"}</button>
      </form>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data-table">
          <thead><tr><th>Grupo</th><th>Categoria Pai</th><th>Nome</th><th>Tipo</th><th></th></tr></thead>
          <tbody>
            {categorias.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--color-muted)" }}>Nenhuma categoria cadastrada.</td></tr>}
            {categorias.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.grupo}</td>
                <td style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>{c.categoriaPai || "—"}</td>
                <td>{c.nome}</td>
                <td><span className={c.tipo === "entrada" ? "badge badge-success" : "badge badge-danger"}>{c.tipo === "entrada" ? "Entrada" : "Saída"}</span></td>
                <td style={{ textAlign: "center" }}>
                  <button onClick={() => excluir(c.id)} style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer" }}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Centros de Custo ─────────────────────────────────────────────────────────
function CentrosCustoSection({ centros, onChange }: { centros: CentroCusto[]; onChange: () => void }) {
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome) return;
    setSaving(true);
    try {
      const res = await fetch("/api/financeiro/centros-custo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setNome("");
      onChange();
    } catch (err: any) {
      alert(err.message || "Erro ao salvar centro de custo");
    } finally {
      setSaving(false);
    }
  };

  const excluir = async (id: string) => {
    if (!confirm("Desativar este centro de custo?")) return;
    const res = await fetch(`/api/financeiro/centros-custo?id=${id}`, { method: "DELETE" });
    if (!res.ok) alert((await res.json()).error || "Erro ao excluir");
    onChange();
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) 2fr", gap: "1.5rem" }}>
      <form onSubmit={salvar} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>Novo Centro de Custo</h3>
        <input placeholder="Ex: Studio, Administrativo" value={nome} onChange={e => setNome(e.target.value)} required />
        <button type="submit" className="btn btn-gold" disabled={saving}><Plus size={14} /> {saving ? "Salvando..." : "Adicionar"}</button>
      </form>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data-table">
          <thead><tr><th>Nome</th><th></th></tr></thead>
          <tbody>
            {centros.length === 0 && <tr><td colSpan={2} style={{ textAlign: "center", padding: "2rem", color: "var(--color-muted)" }}>Nenhum centro de custo cadastrado.</td></tr>}
            {centros.map(c => (
              <tr key={c.id} style={{ opacity: c.ativo ? 1 : 0.4 }}>
                <td style={{ fontWeight: 600 }}>{c.nome}</td>
                <td style={{ textAlign: "center" }}>
                  {c.ativo && <button onClick={() => excluir(c.id)} style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer" }}><Trash2 size={14} /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Palavras-chave (dicionário pra categorizar saídas dos comprovantes do WhatsApp) ──
function PalavrasChaveSection({ palavras, categorias, onChange }: {
  palavras: PalavraChave[];
  categorias: CategoriaFinanceira[];
  onChange: () => void;
}) {
  const [palavraChave, setPalavraChave] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [saving, setSaving] = useState(false);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!palavraChave || !categoriaId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/financeiro/palavras-chave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ palavraChave, categoriaId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setPalavraChave(""); setCategoriaId("");
      onChange();
    } catch (err: any) {
      alert(err.message || "Erro ao salvar palavra-chave");
    } finally {
      setSaving(false);
    }
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir esta palavra-chave?")) return;
    const res = await fetch(`/api/financeiro/palavras-chave?id=${id}`, { method: "DELETE" });
    if (!res.ok) alert((await res.json()).error || "Erro ao excluir");
    onChange();
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) 2fr", gap: "1.5rem" }}>
      <form onSubmit={salvar} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>Nova Palavra-chave</h3>
        <p style={{ fontSize: "0.75rem", color: "var(--color-muted)", margin: 0 }}>
          Se a legenda de um comprovante do WhatsApp contiver essa palavra, a saída é
          categorizada automaticamente. Ex: &quot;almoço&quot; → Alimentação.
        </p>
        <input placeholder="Ex: almoço, uber, gasolina..." value={palavraChave} onChange={e => setPalavraChave(e.target.value)} required />
        <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)} required>
          <option value="">Categoria...</option>
          {categorias.filter(c => c.tipo === "saida").map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <button type="submit" className="btn btn-gold" disabled={saving}><Plus size={14} /> {saving ? "Salvando..." : "Adicionar"}</button>
      </form>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data-table">
          <thead><tr><th>Palavra-chave</th><th>Categoria</th><th></th></tr></thead>
          <tbody>
            {palavras.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", padding: "2rem", color: "var(--color-muted)" }}>Nenhuma palavra-chave cadastrada ainda.</td></tr>}
            {palavras.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.palavraChave}</td>
                <td style={{ fontSize: "0.85rem", color: "var(--color-cream-dim)" }}>{p.categoriaNome}</td>
                <td style={{ textAlign: "center" }}>
                  <button onClick={() => excluir(p.id)} style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer" }}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
