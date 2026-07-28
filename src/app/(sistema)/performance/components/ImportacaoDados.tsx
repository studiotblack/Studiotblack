"use client";

import { useState } from "react";
import { UploadCloud, CheckCircle2, Search, Filter } from "lucide-react";
import { DesempenhoProfissional, normalizeProfName, taxasOcupacaoImportadas } from "@/lib/performance-data";
import * as xlsx from "xlsx";

interface ImportacaoDadosProps {
  data: DesempenhoProfissional[];
  onImport: (data: DesempenhoProfissional[]) => void;
  selectedProf?: string;
  onProfChange?: (prof: string) => void;
  onNavigateToProf?: () => void;
  onOcupacaoImport?: () => void;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Extrai mesAno (MM/YYYY) de uma string de data DD/MM/YYYY ou DD/MM/YYYY HH:mm
const getMesAno = (dataStr: string): string => {
  const parts = dataStr.split("/");
  if (parts.length >= 3) return `${parts[1]}/${parts[2].substring(0, 4)}`;
  return "Geral";
};

export default function ImportacaoDados({ data, onImport, selectedProf, onProfChange, onNavigateToProf, onOcupacaoImport }: ImportacaoDadosProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  
  // Relatório state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterProf, setFilterProf] = useState("Todos");

  const profissionais = ["Todos", ...Array.from(new Set(data.map(d => d.profissional)))];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls") || file.name.endsWith(".csv");
    const isPdf = file.name.endsWith(".pdf");
    
    if (!isExcel && !isPdf) {
      alert("Por favor, envie um arquivo PDF, Excel (.xlsx) ou CSV da Planilha Mestre AppBarber.");
      return;
    }

    setIsUploading(true);
    setUploadSuccess(false);

    if (isPdf) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        
        const res = await fetch("/api/parse-pdf", {
          method: "POST",
          body: formData
        });
        const json = await res.json();
        
        if (json.success && json.items) {
          await mergeAndImport(json.items);
        } else {
          alert("Erro ao ler PDF: " + json.message);
          setIsUploading(false);
        }
      } catch (err) {
        alert("Erro de conexão ao enviar PDF.");
        setIsUploading(false);
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const fileData = e.target?.result;
        const workbook = xlsx.read(fileData, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = xlsx.utils.sheet_to_json(sheet) as any[];
        
        if (jsonData.length === 0) {
          throw new Error("Planilha vazia");
        }

        const keys = Object.keys(jsonData[0]);
        const isOcupacao = keys.includes("Taxa de ocupação") || keys.includes("Média de Ocupação no Período");

        if (isOcupacao) {
          // ── TAXA DE OCUPAÇÃO ──────────────────────────────────────────────
          if (!selectedProf || selectedProf === "") {
            alert("⚠️ Selecione um profissional antes de importar o arquivo de Taxa de Ocupação.");
            setIsUploading(false);
            return;
          }

          let importados = 0;
          const recordsPorMes: Record<string, { jornada: number, atendimento: number, bloqueado: number }> = {};

          // Converte tempo para minutos — aceita "HH:MM:SS" ou número decimal do Excel
          const timeToMins = (t: any): number => {
            if (t === null || t === undefined || t === "") return 0;
            if (typeof t === "number") return Math.round(t * 24 * 60);
            const s = String(t).trim();
            const parts = s.split(":");
            if (parts.length >= 2) {
              return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
            }
            return 0;
          };

          const minsToTime = (m: number) => {
            const h = Math.floor(m / 60);
            const mins = Math.floor(m % 60);
            return `${String(h).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;
          };

          jsonData.forEach(row => {
            const diaRaw = row["Dia"];
            if (!diaRaw) return;
            const diaStr = String(diaRaw).trim().toLowerCase();
            if (diaStr.includes("total") || diaStr.includes("média") || diaStr.includes("media")) return;

            let diaFormatado = diaStr;
            if (typeof diaRaw === "number") {
              const dateObj = new Date((diaRaw - (25567 + 2)) * 86400 * 1000);
              diaFormatado = `${String(dateObj.getDate()).padStart(2, "0")}/${String(dateObj.getMonth() + 1).padStart(2, "0")}/${dateObj.getFullYear()}`;
            }

            let mesAno = "Geral";
            const parts = diaFormatado.split("/");
            if (parts.length === 3) mesAno = `${parts[1]}/${parts[2]}`;
            else if (parts.length === 2) mesAno = `${parts[0]}/${parts[1]}`;

            if (!recordsPorMes[mesAno]) recordsPorMes[mesAno] = { jornada: 0, atendimento: 0, bloqueado: 0 };

            recordsPorMes[mesAno].jornada += timeToMins(row["Tempo de Jornada"]);
            recordsPorMes[mesAno].atendimento += timeToMins(row["Tempo em Atendimento"]);
            recordsPorMes[mesAno].bloqueado += timeToMins(row["Tempo Bloqueado"]);
            importados++;
          });

          const mesesProcessados = Object.keys(recordsPorMes);
          if (mesesProcessados.length === 0) {
            alert("Não foi possível calcular a jornada (Tempo de Jornada zerado).");
            setIsUploading(false);
            return;
          }

          // Salva cada mês no banco (upsert por profissional+mesAno)
          const savePromises = mesesProcessados.map(async mesAno => {
            const totais = recordsPorMes[mesAno];
            if (totais.jornada <= 0) return;
            const taxaOcup = totais.atendimento / totais.jornada;
            const jornadaEfetiva = totais.jornada - totais.bloqueado;
            const taxaOcupComBloqueio = jornadaEfetiva > 0 ? totais.atendimento / jornadaEfetiva : taxaOcup;
            const normalizedProf = normalizeProfName(selectedProf);

            await fetch("/api/performance/ocupacao", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                profissional: normalizedProf,
                mesAno,
                taxaOcupacao: taxaOcup,
                taxaOcupacaoComBloqueios: taxaOcupComBloqueio,
                tempoAtendimentoStr: minsToTime(totais.atendimento),
                tempoBloqueadoStr: minsToTime(totais.bloqueado),
                tempoJornadaStr: minsToTime(totais.jornada),
              }),
            });
          });

          await Promise.all(savePromises);

          setIsUploading(false);
          setUploadSuccess(true);

          const resumo = Object.keys(recordsPorMes).map(mes => {
            const t = recordsPorMes[mes];
            const taxa = t.jornada > 0 ? ((t.atendimento / t.jornada) * 100).toFixed(1) : "0";
            const jornadaEfetiva = t.jornada - t.bloqueado;
            const taxaComBloq = jornadaEfetiva > 0 ? ((t.atendimento / jornadaEfetiva) * 100).toFixed(1) : "0";
            return `  📅 ${mes}: ${taxa}% (s/ bloqueios) | ${taxaComBloq}% (c/ bloqueios)`;
          }).join("\n");

          alert(`✅ Taxa de Ocupação salva no banco para ${normalizeProfName(selectedProf)}!\n\n${importados} dias processados.\n\n${resumo}`);
          onOcupacaoImport?.();
          setTimeout(() => setUploadSuccess(false), 5000);
          return;
        }
        
        // ── COMISSÕES ─────────────────────────────────────────────────────
        const novosDados: DesempenhoProfissional[] = jsonData
          .filter(row => row.Profissional && row.Data && !String(row.Profissional).toLowerCase().includes("total") && !String(row.Profissional).toLowerCase().includes("comissã"))
          .map((row) => {
            const parseToNum = (val: any) => typeof val === "string" ? parseFloat(val.replace("R$", "").replace(/\./g, "").replace(",", ".").trim()) || 0 : Number(val) || 0;
            
            const valorBruto = parseToNum(row["Valor Item"] || row["Valor"] || 0);
            const valorComissao = parseToNum(row["Valor"] || 0);
            
            let dataStr = row["Data"];
            if (typeof dataStr === "number") {
              const dateObj = new Date((dataStr - (25567 + 2)) * 86400 * 1000);
              dataStr = `${String(dateObj.getDate()).padStart(2, "0")}/${String(dateObj.getMonth() + 1).padStart(2, "0")}/${dateObj.getFullYear()} 00:00`;
            }

            const prof = row["Profissional"];
            const serv = row["Serviço/Produto/Pacote"] || "Serviço";
            const cli = row["Cliente"] || "Cliente Avulso";
            const uid = `${prof}-${serv}-${String(dataStr)}-${cli}`.replace(/\s/g, "");

            return {
              id: uid,
              profissional: prof,
              data: String(dataStr),
              cliente: cli,
              item: serv,
              valorBruto,
              valorComissao,
            };
          });

        await mergeAndImport(novosDados);
      } catch (err) {
        console.error(err);
        alert("Erro ao ler arquivo Excel. Verifique se o formato está correto.");
        setIsUploading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  /**
   * Salva comissões no banco.
   * Regras:
   *  - Agrupa por profissional + mês
   *  - Para cada grupo: substitui TODOS os dados daquele profissional+mês no banco
   *  - Outros meses/profissionais NÃO são afetados
   */
  const mergeAndImport = async (novosDados: DesempenhoProfissional[]) => {
    if (novosDados.length === 0) {
      setIsUploading(false);
      alert("⚠️ Nenhum registro encontrado no arquivo.");
      return;
    }

    // Normaliza nomes
    const normalized = novosDados.map(d => ({
      ...d,
      profissional: normalizeProfName(d.profissional),
    }));

    // Agrupa por profissional+mês
    const grupos = new Map<string, { profissional: string; mesAno: string; items: DesempenhoProfissional[] }>();
    normalized.forEach(d => {
      const mesAno = getMesAno(d.data);
      const key = `${d.profissional}||${mesAno}`;
      if (!grupos.has(key)) grupos.set(key, { profissional: d.profissional, mesAno, items: [] });
      grupos.get(key)!.items.push({ ...d, mesAno } as DesempenhoProfissional);
    });

    try {
      // Substitui cada grupo no banco (DELETE + INSERT do mesmo prof+mês)
      for (const grupo of grupos.values()) {
        const res = await fetch("/api/performance/comissoes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            registros: grupo.items,
            mesAno: grupo.mesAno,
            profissional: grupo.profissional,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
      }

      // Atualiza estado local:
      // Remove apenas os meses reimportados, preserva todos os outros
      const gruposKeys = new Set(
        Array.from(grupos.values()).map(g => `${g.profissional}||${g.mesAno}`)
      );
      const dataPreservada = data.filter(d => !gruposKeys.has(`${d.profissional}||${getMesAno(d.data)}`));
      const mergedData = [...dataPreservada, ...normalized];
      onImport(mergedData);

      setIsUploading(false);
      setUploadSuccess(true);

      const resumo = Array.from(grupos.values())
        .map(g => `  • ${g.profissional} — ${g.mesAno}: ${g.items.length} registros`)
        .join("\n");
      alert(`✅ Dados salvos no banco!\n\n${resumo}\n\n📌 Outros meses não foram alterados.`);
      setTimeout(() => setUploadSuccess(false), 5000);
    } catch (err) {
      console.error(err);
      setIsUploading(false);
      alert("❌ Erro ao salvar comissões no banco. Verifique a conexão.");
    }
  };

  const filteredData = data.filter(d => {
    const matchSearch = d.item.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        d.cliente.toLowerCase().includes(searchTerm.toLowerCase());
    const matchProf = filterProf === "Todos" || d.profissional === filterProf;
    return matchSearch && matchProf;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      
      {/* Seletor de Profissional Rápido */}
      <div className="card" style={{ padding: "1.5rem", display: "flex", gap: "1rem", alignItems: "flex-end", background: "linear-gradient(45deg, rgba(20,20,20,1) 0%, rgba(30,25,20,1) 100%)", border: "1px solid rgba(212, 175, 55, 0.2)" }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: "0.9rem", color: "var(--color-cream)", marginBottom: "0.5rem", fontWeight: 600 }}>
            Visualizar Dashboard do Profissional:
          </label>
          <select 
            value={selectedProf || ""} 
            onChange={(e) => onProfChange && onProfChange(e.target.value)}
            style={{
              width: "100%", padding: "0.85rem", background: "rgba(0,0,0,0.4)",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px",
              color: "white", outline: "none", fontSize: "1rem"
            }}
          >
            <option value="" disabled>Selecione um profissional...</option>
            {Array.from(new Set([
              "Henrique Botelho", "Tiago", "Bruna", "Wallacy", "Vanessa",
              ...data.map(d => d.profissional),
              ...taxasOcupacaoImportadas.map(t => t.profissional)
            ])).map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <button 
          onClick={onNavigateToProf}
          disabled={!selectedProf}
          style={{
            padding: "0.85rem 2rem", background: "var(--color-gold)",
            color: "black", border: "none", borderRadius: "6px",
            fontWeight: 700, cursor: selectedProf ? "pointer" : "not-allowed",
            opacity: selectedProf ? 1 : 0.5, transition: "all 0.2s"
          }}
        >
          Ver Dashboard
        </button>
      </div>

      {/* Área de Upload */}
      <div className="card" style={{ textAlign: "center", padding: "3rem 2rem", position: "relative" }}>
        <h3 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>Importar Relatório AppBarber (PDF ou Excel)</h3>
        <p style={{ color: "var(--color-muted)", fontSize: "0.9rem", marginBottom: "2rem" }}>
          Arraste e solte o arquivo PDF de Comissões ou Excel (.xlsx) contendo a base exportada do AppBarber.
        </p>

        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${isDragging ? "var(--color-gold)" : "var(--color-border)"}`,
            borderRadius: "1rem",
            padding: "3rem",
            background: isDragging ? "rgba(212,175,140,0.05)" : "var(--color-surface-2)",
            cursor: "pointer",
            transition: "all 0.2s",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem"
          }}
          onClick={() => document.getElementById("excel-upload")?.click()}
        >
          {isUploading ? (
            <div className="spinner" style={{ width: "40px", height: "40px", border: "3px solid var(--color-surface)", borderTopColor: "var(--color-gold)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          ) : uploadSuccess ? (
            <CheckCircle2 size={48} color="var(--color-success)" />
          ) : (
            <UploadCloud size={48} color={isDragging ? "var(--color-gold)" : "var(--color-muted)"} />
          )}
          
          <div>
            <span style={{ fontWeight: 600, color: "var(--color-cream)" }}>
              {uploadSuccess ? "Importação concluída!" : "Clique ou arraste a planilha aqui"}
            </span>
            {!uploadSuccess && <div style={{ fontSize: "0.8rem", color: "var(--color-muted)", marginTop: "0.5rem" }}>Formatos suportados: .pdf, .xlsx, .xls, .csv</div>}
          </div>
          
          <input 
            type="file" 
            id="excel-upload" 
            accept=".pdf,.xlsx,.xls,.csv" 
            style={{ display: "none" }} 
            onChange={handleFileSelect}
          />
        </div>
      </div>

      {/* Lista de Registros */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Últimos Registros Importados</h3>
          
          <div style={{ display: "flex", gap: "1rem" }}>
            <div style={{ position: "relative" }}>
              <Search size={16} color="var(--color-muted)" style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)" }} />
              <input 
                type="text" 
                placeholder="Buscar cliente ou serviço..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "2rem", padding: "0.5rem 1rem 0.5rem 2.5rem", color: "var(--color-cream)", width: "250px" }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "var(--color-surface)", padding: "0.5rem 1rem", borderRadius: "2rem", border: "1px solid var(--color-border)" }}>
              <Filter size={16} color="var(--color-gold)" />
              <select 
                value={filterProf} 
                onChange={e => setFilterProf(e.target.value)}
                style={{ background: "transparent", border: "none", color: "var(--color-cream)", outline: "none" }}
              >
                {profissionais.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table" style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                <th style={{ padding: "1rem 0.5rem", color: "var(--color-muted)", fontWeight: 500 }}>Data</th>
                <th style={{ padding: "1rem 0.5rem", color: "var(--color-muted)", fontWeight: 500 }}>Profissional</th>
                <th style={{ padding: "1rem 0.5rem", color: "var(--color-muted)", fontWeight: 500 }}>Cliente</th>
                <th style={{ padding: "1rem 0.5rem", color: "var(--color-muted)", fontWeight: 500 }}>Serviço/Produto</th>
                <th style={{ padding: "1rem 0.5rem", color: "var(--color-muted)", fontWeight: 500, textAlign: "right" }}>Valor Bruto</th>
                <th style={{ padding: "1rem 0.5rem", color: "var(--color-muted)", fontWeight: 500, textAlign: "right" }}>Comissão</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.slice(0, 15).map((d) => (
                <tr key={d.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "1rem 0.5rem", fontSize: "0.9rem" }}>{d.data.substring(0, 5)}</td>
                  <td style={{ padding: "1rem 0.5rem", fontWeight: 600 }}>{d.profissional}</td>
                  <td style={{ padding: "1rem 0.5rem", color: "var(--color-cream-dim)" }}>{d.cliente}</td>
                  <td style={{ padding: "1rem 0.5rem" }}>{d.item}</td>
                  <td style={{ padding: "1rem 0.5rem", textAlign: "right", color: "var(--color-gold)" }}>{brl(d.valorBruto)}</td>
                  <td style={{ padding: "1rem 0.5rem", textAlign: "right", color: "var(--color-success)" }}>{brl(d.valorComissao)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredData.length > 15 && (
            <div style={{ textAlign: "center", padding: "1rem", color: "var(--color-muted)", fontSize: "0.9rem" }}>
              Mostrando os 15 registros mais recentes (Total: {filteredData.length})
            </div>
          )}
          {filteredData.length === 0 && (
            <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-muted)" }}>
              Nenhum registro encontrado.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
