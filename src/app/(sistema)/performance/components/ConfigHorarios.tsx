"use client";

import { useState } from "react";
import { Clock, Save } from "lucide-react";
import { getProfissionaisUnicos, DesempenhoProfissional } from "@/lib/performance-data";

export interface Jornada {
  tempoServico: number;
  segunda: number;
  terca: number;
  quarta: number;
  quinta: number;
  sexta: number;
  sabado: number;
  domingo: number;
}

export type ConfigHorariosType = Record<string, Jornada>;

interface ConfigHorariosProps {
  data: DesempenhoProfissional[];
  horarios: ConfigHorariosType;
  setHorarios: (h: ConfigHorariosType) => void;
}

const DIAS_SEMANA = [
  { key: "segunda", label: "Segunda-feira" },
  { key: "terca", label: "Terça-feira" },
  { key: "quarta", label: "Quarta-feira" },
  { key: "quinta", label: "Quinta-feira" },
  { key: "sexta", label: "Sexta-feira" },
  { key: "sabado", label: "Sábado" },
  { key: "domingo", label: "Domingo" },
] as const;

export default function ConfigHorarios({ data, horarios, setHorarios }: ConfigHorariosProps) {
  const profissionais = getProfissionaisUnicos(data);
  const [selectedProf, setSelectedProf] = useState<string>(profissionais[0] || "");
  const [saved, setSaved] = useState(false);

  if (!selectedProf) return <div style={{ color: "var(--color-muted)" }}>Nenhum profissional disponível.</div>;

  const currentJornada = horarios[selectedProf] || {
    tempoServico: 40, segunda: 0, terca: 8, quarta: 8, quinta: 8, sexta: 8, sabado: 8, domingo: 0
  };

  const handleDayChange = (dia: keyof Jornada, horas: number) => {
    setHorarios({
      ...horarios,
      [selectedProf]: { ...currentJornada, [dia]: horas }
    });
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
          <Clock color="var(--color-gold)" size={24} />
          <div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Jornada de Trabalho</h3>
            <p style={{ color: "var(--color-muted)", fontSize: "0.85rem", margin: 0 }}>Configure as horas disponíveis de cada profissional por dia da semana.</p>
          </div>
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>Selecione o Profissional:</label>
          <select 
            value={selectedProf} 
            onChange={e => setSelectedProf(e.target.value)}
            style={{ width: "300px", background: "var(--color-surface-2)", padding: "0.5rem", borderRadius: "0.5rem", border: "1px solid var(--color-border)", color: "var(--color-cream)" }}
          >
            {profissionais.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "rgba(255,255,255,0.02)", borderRadius: "0.5rem", border: "1px solid var(--color-border)" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>Tempo Médio do Serviço (Minutos):</label>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input 
              type="number" 
              min="1" max="240"
              value={currentJornada.tempoServico}
              onChange={e => handleDayChange("tempoServico", Number(e.target.value))}
              style={{ width: "100px", background: "var(--color-surface)", border: "1px solid var(--color-border)", padding: "0.5rem", borderRadius: "0.25rem", color: "var(--color-cream)" }}
            />
            <span style={{ fontSize: "0.85rem", color: "var(--color-muted)" }}>minutos por serviço</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" }}>
          {DIAS_SEMANA.map(dia => (
            <div key={dia.key} style={{ background: "rgba(255,255,255,0.02)", padding: "1rem", borderRadius: "0.5rem", border: "1px solid var(--color-border)" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "var(--color-cream-dim)" }}>{dia.label}</label>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input 
                  type="number" 
                  min="0" max="24"
                  value={currentJornada[dia.key]}
                  onChange={e => handleDayChange(dia.key, Number(e.target.value))}
                  style={{ width: "80px", background: "var(--color-surface)", border: "1px solid var(--color-border)", padding: "0.5rem", borderRadius: "0.25rem", color: "var(--color-cream)" }}
                />
                <span style={{ fontSize: "0.85rem", color: "var(--color-muted)" }}>horas</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "2rem", display: "flex", alignItems: "center", gap: "1rem" }}>
          <button onClick={handleSave} className="btn-primary" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Save size={16} /> Salvar Horários
          </button>
          {saved && <span style={{ color: "var(--color-success)", fontSize: "0.9rem" }}>Horários salvos com sucesso!</span>}
        </div>
      </div>
    </div>
  );
}
