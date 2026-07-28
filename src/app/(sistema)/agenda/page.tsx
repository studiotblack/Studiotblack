"use client";

import { useState, useEffect } from "react";
import { clientes, servicos, agendamentosHoje, horariosAgenda } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth-context";
import { Plus, Check, X, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

interface Appointment {
  id: string;
  hora: string;
  cliente: string;
  colaborador: string;
  corColab: string;
  servico: string;
  duracao: number;
  status: string;
  valor: number;
}

export default function AgendaPage() {
  const { usuarios } = useAuth();
  // Filter active barbers to be used in the schedule
  const activeColaboradores = usuarios.filter(u => u.permissoes.includes("/agenda") || u.isAdmin);

  const [appointments, setAppointments] = useState<Appointment[]>(agendamentosHoje);
  const [selectedDate, setSelectedDate] = useState("2026-05-20");
  const [selectedColabFilter, setSelectedColabFilter] = useState("todos");

  // Mobile view states
  const [mobileSelectedColabId, setMobileSelectedColabId] = useState(activeColaboradores[0]?.id || "");
  const [currentHour, setCurrentHour] = useState(new Date().getHours() + new Date().getMinutes() / 60);

  useEffect(() => {
    // Current time simulator for red line (in reality, just use current time)
    const updateTime = () => setCurrentHour(new Date().getHours() + new Date().getMinutes() / 60);
    const interval = setInterval(updateTime, 60000);
    updateTime();
    return () => clearInterval(interval);
  }, []);

  // State for Novo Agendamento Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newColabId, setNewColabId] = useState(activeColaboradores[0]?.id || "");
  const [newServicoId, setNewServicoId] = useState(servicos[0]?.id || "");
  const [newHora, setNewHora] = useState(horariosAgenda[0] || "");

  // State for Transfer / Edit Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAppoint, setEditingAppoint] = useState<Appointment | null>(null);
  const [transferColabId, setTransferColabId] = useState("");
  const [transferHora, setTransferHora] = useState("");

  const filteredColabs = selectedColabFilter === "todos" 
    ? activeColaboradores 
    : activeColaboradores.filter(c => c.id === selectedColabFilter);

  const handleAddAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName) return;

    const colab = activeColaboradores.find(c => c.id === newColabId)!;
    const serv = servicos.find(s => s.id === newServicoId)!;

    const hasConflict = appointments.some(a => a.colaborador === newColabId && a.hora === newHora);
    if (hasConflict) {
      alert("Aviso: Conflito detectado! Este profissional já possui agendamento neste horário.");
    }

    const newApp: Appointment = {
      id: `a-${Date.now()}`,
      hora: newHora,
      cliente: newClientName,
      colaborador: newColabId,
      corColab: colab.cor,
      servico: serv.nome,
      duracao: serv.duracao,
      status: "AGENDADO",
      valor: serv.preco
    };

    setAppointments([...appointments, newApp]);
    setShowNewModal(false);
    setNewClientName("");
  };

  const handleOpenEdit = (app: Appointment) => {
    setEditingAppoint(app);
    setTransferColabId(app.colaborador);
    setTransferHora(app.hora);
    setShowEditModal(true);
  };

  const handleUpdateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAppoint) return;

    const targetColab = activeColaboradores.find(c => c.id === transferColabId)!;

    if (transferColabId !== editingAppoint.colaborador || transferHora !== editingAppoint.hora) {
      const conflict = appointments.some(a => a.id !== editingAppoint.id && a.colaborador === transferColabId && a.hora === transferHora);
      if (conflict) {
        alert("Aviso: Conflito detectado no novo horário/colaborador selecionado.");
      }
    }

    setAppointments(appointments.map(a => {
      if (a.id === editingAppoint.id) {
        return { ...a, colaborador: transferColabId, corColab: targetColab.cor, hora: transferHora };
      }
      return a;
    }));

    setShowEditModal(false);
    setEditingAppoint(null);
  };

  const handleStatusChange = (appId: string, newStatus: string) => {
    setAppointments(appointments.map(a => {
      if (a.id === appId) {
        return { ...a, status: newStatus };
      }
      return a;
    }));
    if (editingAppoint?.id === appId) {
      setEditingAppoint(prev => prev ? { ...prev, status: newStatus } : null);
    }
  };

  return (
    <div className="page-container animate-fadeIn" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Desktop Header */}
      <div className="hidden md:flex page-header" style={{ marginBottom: "1rem" }}>
        <div>
          <h1 className="page-title text-glow-gold">Agenda de Atendimento</h1>
          <p className="page-subtitle">Visualização multi-profissional e controle de horários</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <select value={selectedColabFilter} onChange={(e) => setSelectedColabFilter(e.target.value)} style={{ width: "auto" }}>
            <option value="todos">Todos os Barbeiros</option>
            {activeColaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ width: "auto" }} />
          <button className="btn btn-gold" onClick={() => setShowNewModal(true)}>
            <Plus size={16} /> Novo Agendamento
          </button>
        </div>
      </div>

      {/* MOBILE AGENDA VIEW */}
      <div className="md:hidden" style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", margin: "-0.875rem", background: "var(--color-bg)" }}>
        
        {/* Date Selector */}
        <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <ChevronLeft size={20} color="var(--color-gold)" />
            <span style={{ fontWeight: 600, fontSize: "1rem" }}>Maio 2026</span>
            <ChevronRight size={20} color="var(--color-gold)" />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            {[17, 18, 19, 20, 21, 22, 23].map(day => (
              <div key={day} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem" }}>
                <span style={{ fontSize: "0.65rem", color: "var(--color-muted)" }}>
                  {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][day % 7]}
                </span>
                <span style={{ 
                  fontWeight: 600, fontSize: "0.875rem", width: "32px", height: "32px", 
                  display: "flex", alignItems: "center", justifyContent: "center", 
                  borderRadius: "50%", 
                  background: day === 21 ? "var(--color-gold)" : "transparent",
                  color: day === 21 ? "#000" : "var(--color-cream)"
                }}>{day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Colab Tabs */}
        <div style={{ display: "flex", overflowX: "auto", padding: "0.75rem 1rem", gap: "1rem", borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)", scrollbarWidth: "none" }}>
          {activeColaboradores.map(colab => {
            const active = mobileSelectedColabId === colab.id;
            return (
              <button key={colab.id} onClick={() => setMobileSelectedColabId(colab.id)} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: "0.375rem",
                background: "none", border: "none", cursor: "pointer", minWidth: "60px"
              }}>
                <div className="avatar avatar-md" style={{ 
                  background: `linear-gradient(135deg, ${colab.cor}, var(--color-bg))`,
                  border: active ? "2px solid var(--color-gold)" : "2px solid transparent",
                }}>
                  {colab.nome.charAt(0)}
                </div>
                <span style={{ 
                  fontSize: "0.75rem", fontWeight: active ? 600 : 400,
                  background: active ? "var(--color-surface-3)" : "transparent",
                  padding: "0.25rem 0.75rem", borderRadius: "999px",
                  color: active ? "var(--color-cream)" : "var(--color-muted)" 
                }}>
                  {colab.nome.split(" ")[0]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Mobile Schedule Grid */}
        <div style={{ flex: 1, overflowY: "auto", position: "relative", padding: "0" }}>
          {/* Timeline background */}
          <div style={{ position: "relative", minHeight: "1200px" }}>
            {Array.from({ length: 13 }).map((_, i) => {
              const hour = i + 8;
              return (
                <div key={hour} style={{ 
                  position: "absolute", top: `${i * 60}px`, width: "100%", 
                  borderTop: "1px solid var(--color-border)", display: "flex", height: "60px" 
                }}>
                  <div style={{ width: "60px", padding: "0.25rem", textAlign: "right", fontSize: "0.7rem", color: "var(--color-muted)", borderRight: "1px solid var(--color-border)" }}>
                    {hour}:00
                  </div>
                  <div style={{ flex: 1 }} />
                </div>
              );
            })}

            {/* Current Time Indicator */}
            {currentHour >= 8 && currentHour <= 20 && (
              <div style={{ 
                position: "absolute", top: `${(currentHour - 8) * 60}px`, left: "60px", right: 0, 
                borderTop: "2px solid #e74c3c", zIndex: 10 
              }}>
                <div style={{ 
                  position: "absolute", left: "-60px", top: "-10px", width: "60px", textAlign: "center", 
                  background: "#e74c3c", color: "#fff", fontSize: "0.65rem", padding: "2px 0", borderRadius: "2px" 
                }}>
                  {Math.floor(currentHour).toString().padStart(2, '0')}:{Math.floor((currentHour % 1) * 60).toString().padStart(2, '0')}
                </div>
              </div>
            )}

            {/* Appointments */}
            {appointments.filter(a => a.colaborador === mobileSelectedColabId).map(app => {
              const startHour = parseInt(app.hora.split(":")[0]);
              const startMin = parseInt(app.hora.split(":")[1]);
              const top = (startHour - 8) * 60 + startMin;
              const height = app.duracao;

              return (
                <div key={app.id} onClick={() => handleOpenEdit(app)} style={{
                  position: "absolute", top: `${top}px`, left: "64px", right: "8px", height: `${height}px`,
                  background: app.status === "CONCLUIDO" ? "var(--color-success-dim)" :
                              app.status === "AGENDADO" ? "var(--color-info-dim)" :
                              "var(--color-surface-2)",
                  borderLeft: `4px solid ${app.corColab}`,
                  borderRadius: "4px", padding: "0.25rem 0.5rem", cursor: "pointer",
                  display: "flex", flexDirection: "column", justifyContent: "flex-start",
                  overflow: "hidden", zIndex: 5, border: "1px solid var(--color-border)", borderLeftWidth: "4px"
                }}>
                  <div style={{ fontSize: "0.65rem", color: "var(--color-muted)" }}>{app.hora} - {startHour + Math.floor((startMin + app.duracao)/60)}:{(startMin + app.duracao)%60 === 0 ? "00" : (startMin + app.duracao)%60}</div>
                  <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-cream)" }}>{app.servico}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-cream-dim)" }}>{app.cliente}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* FAB Button */}
        <button onClick={() => setShowNewModal(true)} style={{
          position: "fixed", bottom: "80px", right: "20px", width: "56px", height: "56px",
          borderRadius: "50%", background: "var(--color-info)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center", border: "none",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)", zIndex: 50, cursor: "pointer"
        }}>
          <Plus size={24} />
        </button>
      </div>

      {/* DESKTOP AGENDA VIEW */}
      <div className="hidden md:block card" style={{ padding: "1.25rem", overflowX: "auto", flex: 1 }}>
        <div style={{ minWidth: filteredColabs.length * 200 + 100 }}>
          {/* Columns Header */}
          <div style={{ display: "grid", gridTemplateColumns: `100px repeat(${filteredColabs.length}, 1fr)`, borderBottom: "2px solid var(--color-border)", paddingBottom: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-muted)", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase" }}>
              Horário
            </div>
            {filteredColabs.map(colab => (
              <div key={colab.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyItems: "center", borderLeft: "1px solid var(--color-border)", padding: "0 0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span className="collab-dot" style={{ backgroundColor: colab.cor }} />
                  <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{colab.nome}</span>
                </div>
                <span style={{ fontSize: "0.7rem", color: "var(--color-muted)" }}>{colab.cargo}</span>
              </div>
            ))}
          </div>

          {/* Time Slots */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {horariosAgenda.map((horaSlot) => (
              <div key={horaSlot} style={{ display: "grid", gridTemplateColumns: `100px repeat(${filteredColabs.length}, 1fr)`, borderBottom: "1px solid rgba(45, 31, 32, 0.4)", minHeight: "4rem" }}>
                {/* Time side-label */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: "0.875rem", color: "var(--color-gold-dim)" }}>
                  {horaSlot}
                </div>

                {/* Collaborator Grid Cell */}
                {filteredColabs.map(colab => {
                  const appointment = appointments.find(a => a.colaborador === colab.id && a.hora === horaSlot);

                  return (
                    <div key={colab.id} style={{ borderLeft: "1px solid var(--color-border)", position: "relative", padding: "4px", display: "flex", alignItems: "stretch" }}>
                      {appointment ? (
                        <div onClick={() => handleOpenEdit(appointment)} style={{
                            flex: 1, borderRadius: "6px", background: "var(--color-surface-2)",
                            borderLeft: `4px solid ${appointment.corColab}`, border: `1px solid var(--color-border)`,
                            padding: "0.375rem 0.625rem", cursor: "pointer", transition: "all 0.15s",
                            display: "flex", flexDirection: "column", justifyContent: "space-between"
                          }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.25rem" }}>
                            <span style={{ fontWeight: 600, fontSize: "0.8rem", color: "var(--color-cream)" }}>{appointment.cliente}</span>
                            <span className={`badge ${
                              appointment.status === "CONCLUIDO" ? "badge-success" :
                              appointment.status === "CONFIRMADO" ? "badge-purple" :
                              appointment.status === "CANCELADO" ? "badge-danger" :
                              appointment.status === "FALTA" ? "badge-warning" : "badge-info"
                            }`} style={{ fontSize: "0.55rem", padding: "1px 4px" }}>
                              {appointment.status}
                            </span>
                          </div>
                          <div style={{ display: "flex", justifyItems: "center", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--color-muted)", marginTop: "4px" }}>
                            <span>{appointment.servico}</span>
                            <span style={{ color: "var(--color-gold)" }}>R$ {appointment.valor}</span>
                          </div>
                        </div>
                      ) : (
                        <div onClick={() => { setNewColabId(colab.id); setNewHora(horaSlot); setShowNewModal(true); }}
                          style={{ flex: 1, cursor: "pointer", borderRadius: "4px" }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MODAL: NOVO AGENDAMENTO */}
      {showNewModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 500 }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>Novo Agendamento</h2>
              <button onClick={() => setShowNewModal(false)} style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddAppointment} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div>
                <label className="form-label">Nome do Cliente</label>
                <input type="text" placeholder="Ex: João da Silva" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} list="clients-list" required />
                <datalist id="clients-list">
                  {clientes.map(c => <option key={c.id} value={c.nome} />)}
                </datalist>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label className="form-label">Profissional</label>
                  <select value={newColabId} onChange={(e) => setNewColabId(e.target.value)}>
                    {activeColaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Horário</label>
                  <select value={newHora} onChange={(e) => setNewHora(e.target.value)}>
                    {horariosAgenda.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">Serviço</label>
                <select value={newServicoId} onChange={(e) => setNewServicoId(e.target.value)}>
                  {servicos.map(s => <option key={s.id} value={s.id}>{s.nome} (R$ {s.preco} - {s.duracao} min)</option>)}
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowNewModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-gold">Confirmar Agendamento</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR / TRANSFERIR AGENDAMENTO */}
      {showEditModal && editingAppoint && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 500 }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>Gerenciar Agendamento</h2>
              <button onClick={() => setShowEditModal(false)} style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <div style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", padding: "1rem", borderRadius: "8px" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.5rem 0", color: "var(--color-gold)" }}>{editingAppoint.cliente}</h3>
                <div style={{ fontSize: "0.8125rem", display: "flex", flexDirection: "column", gap: "0.25rem", color: "var(--color-cream-dim)" }}>
                  <span>Serviço: <strong>{editingAppoint.servico}</strong></span>
                  <span>Valor do Serviço: <strong>R$ {editingAppoint.valor}</strong></span>
                  <span>Duração estimada: <strong>{editingAppoint.duracao} minutos</strong></span>
                </div>
              </div>
              <div>
                <label className="form-label">Alterar Status</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {["AGENDADO", "CONFIRMADO", "CONCLUIDO", "CANCELADO", "FALTA"].map((st) => (
                    <button key={st} type="button" onClick={() => handleStatusChange(editingAppoint.id, st)}
                      className={`btn btn-sm ${editingAppoint.status === st ? "" : "btn-ghost"}`}
                      style={{
                        background: editingAppoint.status === st ? (
                          st === "CONCLUIDO" ? "var(--color-success)" :
                          st === "CANCELADO" ? "var(--color-danger)" :
                          st === "FALTA" ? "var(--color-warning)" :
                          st === "CONFIRMADO" ? "var(--color-status-confirmado)" : "var(--color-info)"
                        ) : "transparent",
                        color: editingAppoint.status === st ? "#fff" : "var(--color-cream-dim)",
                      }}>
                      {st}
                    </button>
                  ))}
                </div>
              </div>
              <form onSubmit={handleUpdateAppointment} style={{ display: "flex", flexDirection: "column", gap: "1.25rem", borderTop: "1px solid var(--color-border)", paddingTop: "1.25rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--color-gold)", fontWeight: 500, fontSize: "0.875rem" }}>
                  <RefreshCw size={16} /> <span>Transferir Agendamento</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label className="form-label">Novo Barbeiro</label>
                    <select value={transferColabId} onChange={(e) => setTransferColabId(e.target.value)}>
                      {activeColaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Novo Horário</label>
                    <select value={transferHora} onChange={(e) => setTransferHora(e.target.value)}>
                      {horariosAgenda.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowEditModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-gold">Confirmar Transferência</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
