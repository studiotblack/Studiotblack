"use client";

import { useState } from "react";
import { Settings, Shield, User, Bell, Sliders, Scissors, Landmark, LogIn } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function ConfiguracoesPage() {
  const [activeTab, setActiveTab] = useState("empresa"); // empresa | agenda | seguranca | acesso
  const { usuarioAtivo, setUsuarioAtivo, usuarios } = useAuth();

  // Studio configs state
  const [nomeEmpresa, setNomeEmpresa] = useState("Studio T' Black");
  const [cnpj, setCnpj] = useState("12.345.678/0001-90");
  const [telefone, setTelefone] = useState("(11) 98888-7777");
  const [email, setEmail] = useState("contato@studiotblack.com.br");
  const [endereco, setEndereco] = useState("Rua Principal, 123 - Centro");

  // Calendar config
  const [intervalo, setIntervalo] = useState(30);
  const [horaAbertura, setHoraAbertura] = useState("08:00");
  const [horaFechamento, setHoraFechamento] = useState("20:00");
  const [bloquearConflitos, setBloquearConflitos] = useState(true);

  // Security config
  const [autoLogout, setAutoLogout] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("https://studiotblack.web316.com.br/api/appointments");

  return (
    <div className="page-container animate-fadeIn">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title text-glow-gold">Configurações Gerais</h1>
          <p className="page-subtitle">Personalize a identidade da empresa, regras da agenda inteligente e segurança do sistema</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: "1.5rem" }} className="grid-cols-1 md:grid-cols-[200px_1fr]">
        
        {/* Left Side menu navigation */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <button
            onClick={() => setActiveTab("empresa")}
            className={`sidebar-item ${activeTab === "empresa" ? "active" : ""}`}
            style={{ border: "none", width: "100%", background: activeTab === "empresa" ? "" : "transparent" }}
          >
            <Scissors size={18} />
            <span>Minha Empresa</span>
          </button>
          
          <button
            onClick={() => setActiveTab("agenda")}
            className={`sidebar-item ${activeTab === "agenda" ? "active" : ""}`}
            style={{ border: "none", width: "100%", background: activeTab === "agenda" ? "" : "transparent" }}
          >
            <Sliders size={18} />
            <span>Regras de Agenda</span>
          </button>

          <button
            onClick={() => setActiveTab("seguranca")}
            className={`sidebar-item ${activeTab === "seguranca" ? "active" : ""}`}
            style={{ border: "none", width: "100%", background: activeTab === "seguranca" ? "" : "transparent" }}
          >
            <Shield size={18} />
            <span>Segurança e Integração</span>
          </button>

          <div className="divider" style={{ margin: "0.5rem 0" }} />

          <button
            onClick={() => setActiveTab("acesso")}
            className={`sidebar-item ${activeTab === "acesso" ? "active" : ""}`}
            style={{ border: "none", width: "100%", background: activeTab === "acesso" ? "" : "transparent", color: "var(--color-gold)" }}
          >
            <LogIn size={18} />
            <span>Trocar Usuário</span>
          </button>
        </div>

        {/* Right side Settings card form */}
        <div className="card">
          
          {/* TAB: EMPRESA */}
          {activeTab === "empresa" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>Identidade do Estabelecimento</h3>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label className="form-label">Razão Social / Nome Fantasia</label>
                  <input
                    type="text"
                    value={nomeEmpresa}
                    onChange={(e) => setNomeEmpresa(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">CNPJ</label>
                  <input
                    type="text"
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label className="form-label">Telefone Comercial</label>
                  <input
                    type="text"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">E-mail para Contato</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Endereço da Barbearia</label>
                <input
                  type="text"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                />
              </div>

              <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1.25rem", display: "flex", justifyContent: "flex-end" }}>
                <button className="btn btn-gold" onClick={() => alert("Informações da empresa salvas com sucesso!")}>
                  Salvar Alterações
                </button>
              </div>
            </div>
          )}

          {/* TAB: AGENDA */}
          {activeTab === "agenda" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>Comportamento da Grade de Agenda</h3>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                <div>
                  <label className="form-label">Intervalo Padrão</label>
                  <select value={intervalo} onChange={(e) => setIntervalo(Number(e.target.value))}>
                    <option value={15}>15 minutos</option>
                    <option value={30}>30 minutos</option>
                    <option value={45}>45 minutos</option>
                    <option value={60}>60 minutos</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Início Expediente</label>
                  <input
                    type="time"
                    value={horaAbertura}
                    onChange={(e) => setHoraAbertura(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Fim Expediente</label>
                  <input
                    type="time"
                    value={horaFechamento}
                    onChange={(e) => setHoraFechamento(e.target.value)}
                  />
                </div>
              </div>

              <div style={{
                background: "var(--color-surface-2)",
                padding: "1rem", borderRadius: "8px", border: "1px solid var(--color-border)",
                display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "space-between"
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--color-cream)" }}>Impedir agendamentos duplicados</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Evita conflitos de horário para o mesmo profissional</div>
                </div>
                <input
                  type="checkbox"
                  checked={bloquearConflitos}
                  onChange={(e) => setBloquearConflitos(e.target.checked)}
                  style={{ width: "20px", height: "20px", cursor: "pointer" }}
                />
              </div>

              <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1.25rem", display: "flex", justifyContent: "flex-end" }}>
                <button className="btn btn-gold" onClick={() => alert("Regras de agenda salvas com sucesso!")}>
                  Salvar Regras
                </button>
              </div>
            </div>
          )}

          {/* TAB: SEGURANÇA */}
          {activeTab === "seguranca" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>Parâmetros do Sistema</h3>

              <div>
                <label className="form-label">Webhook URL (Notificações de Agendamentos)</label>
                <input
                  type="url"
                  placeholder="https://sua-url.com/webhook"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
                <span style={{ fontSize: "0.7rem", color: "var(--color-muted)" }}>
                  Será enviado um payload JSON a cada agendamento criado, alterado ou concluído.
                </span>
              </div>

              <div style={{
                background: "var(--color-surface-2)",
                padding: "1rem", borderRadius: "8px", border: "1px solid var(--color-border)",
                display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "space-between"
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--color-cream)" }}>Desconexão automática</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Exige login após 15 minutos de inatividade</div>
                </div>
                <input
                  type="checkbox"
                  checked={autoLogout}
                  onChange={(e) => setAutoLogout(e.target.checked)}
                  style={{ width: "20px", height: "20px", cursor: "pointer" }}
                />
              </div>

              <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1.25rem", display: "flex", justifyContent: "flex-end" }}>
                <button className="btn btn-gold" onClick={() => alert("Configurações de integração salvas!")}>
                  Salvar Parâmetros
                </button>
              </div>
            </div>
          )}

          {/* TAB: TROCAR USUARIO */}
          {activeTab === "acesso" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0, color: "var(--color-gold)" }}>Simular Acesso (Troca Rápida de Usuário)</h3>
              <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", margin: "-0.5rem 0 0.5rem 0" }}>
                Selecione abaixo com qual usuário deseja testar o sistema. Isso recarregará o menu lateral para refletir as permissões do usuário escolhido.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" }}>
                {usuarios.map(u => (
                  <button
                    key={u.id}
                    onClick={() => setUsuarioAtivo(u)}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.75rem",
                      padding: "1rem", borderRadius: "8px",
                      background: usuarioAtivo.id === u.id ? "rgba(212,175,140,0.1)" : "var(--color-surface-2)",
                      border: `1px solid ${usuarioAtivo.id === u.id ? "var(--color-gold)" : "var(--color-border)"}`,
                      cursor: "pointer", textAlign: "left", transition: "all 0.2s"
                    }}
                  >
                    <div className="avatar avatar-md" style={{ background: `linear-gradient(135deg, ${u.cor}, var(--color-bg))` }}>
                      {u.nome.charAt(0)}
                    </div>
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--color-cream)", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                        {u.nome}
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "var(--color-muted)" }}>{u.cargo}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
