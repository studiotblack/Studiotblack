"use client";

import { useState } from "react";
import { UploadCloud, CheckCircle2, AlertCircle, X, Search, Filter } from "lucide-react";
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

// Interface para os Modais de Status Customizados
interface ModalState {
  isOpen: boolean;
  type: "success" | "error" | "warning";
  title: string;
  message: string;
  details?: string;
}

export default function ImportacaoDados({ data, onImport, selectedProf, onProfChange, onNavigateToProf, onOcupacaoImport }: ImportacaoDadosProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Modal customizado state
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    type: "success",
    title: "",
    message: "",
  });
  
  // Relatório state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterProf, setFilterProf] = useState("Todos");

  // Gerenciar / Excluir dados state
  const [deleteProf, setDeleteProf] = useState("");
  const [deleteMes, setDeleteMes] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const profissionais = ["Todos", ...Array.from(new Set(data.map(d => d.profissional)))];

  // Lista de meses disponíveis no banco para o profissional selecionado
  const mesesDisponiveis = Array.from(
    new Set(data
      .filter(d => !deleteProf || d.profissional === deleteProf)
      .map(d => getMesAno(d.data))
    )
  ).sort().reverse();

  const deleteData = async () => {
    if (!deleteProf || !deleteMes) {
      showNotification("warning", "Seleção Incompleta", "Selecione o profissional e o mês que deseja excluir.");
      return;
    }
    setConfirmDelete(false);
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/performance/comissoes?profissional=${encodeURIComponent(deleteProf)}&mesAno=${encodeURIComponent(deleteMes)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erro HTTP ${res.status}`);
      }
      // Recarrega do banco
      const resComissoes = await fetch("/api/performance/comissoes");
      if (resComissoes.ok) {
        const comissoes = await resComissoes.json();
        onImport(comissoes);
      }
      setDeleteProf("");
      setDeleteMes("");
      showNotification("success", "Dados Excluídos!", `Os registros de ${deleteProf} em ${deleteMes} foram removidos com sucesso do banco.`);
    } catch (err: any) {
      showNotification("error", "Erro ao Excluir", err.message || "Não foi possível excluir os dados.");
    } finally {
      setIsDeleting(false);
    }
  };

  const showNotification = (type: "success" | "error" | "warning", title: string, message: string, details?: string) => {
    setModal({
      isOpen: true,
      type,
      title,
      message,
      details,
    });
  };

  const closeModal = () => {
    setModal(prev => ({ ...prev, isOpen: false }));
  };

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
      showNotification("warning", "Formato Inválido", "Por favor, envie um arquivo PDF, Excel (.xlsx) ou CSV exportado do AppBarber.");
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
          showNotification("error", "Falha na Leitura do PDF", json.message || "Não foi possível extrair os dados deste PDF.");
          setIsUploading(false);
        }
      } catch (err: any) {
        showNotification("error", "Erro de Conexão", "Não foi possível conectar ao servidor para processar o PDF.");
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
          throw new Error("A planilha selecionada está vazia.");
        }

        const keys = Object.keys(jsonData[0]);
        const isOcupacao = keys.includes("Taxa de ocupação") || keys.includes("Média de Ocupação no Período");

        if (isOcupacao) {
          // ── TAXA DE OCUPAÇÃO ──────────────────────────────────────────────
          if (!selectedProf || selectedProf === "") {
            showNotification(
              "warning", 
              "Selecione o Barbeiro/Profissional", 
              "Selecione um profissional no campo 'Visualizar Dashboard do Profissional' acima antes de enviar a planilha de ocupação."
            );
            setIsUploading(false);
            return;
          }

          let importados = 0;
          const recordsPorMes: Record<string, { jornada: number, atendimento: number, bloqueado: number }> = {};

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
            showNotification("warning", "Dados Inválidos", "Não foi possível calcular a jornada nesta planilha (valores zerados ou colunas com nomes incompatíveis).");
            setIsUploading(false);
            return;
          }

          // Salva no banco via API
          try {
            const savePromises = mesesProcessados.map(async mesAno => {
              const totais = recordsPorMes[mesAno];
              if (totais.jornada <= 0) return;
              const taxaOcup = totais.atendimento / totais.jornada;
              const jornadaEfetiva = totais.jornada - totais.bloqueado;
              const taxaOcupComBloqueio = jornadaEfetiva > 0 ? totais.atendimento / jornadaEfetiva : taxaOcup;
              const normalizedProf = normalizeProfName(selectedProf);

              const res = await fetch("/api/performance/ocupacao", {
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

              if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || "Erro de servidor ao salvar ocupação.");
              }
            });

            await Promise.all(savePromises);

            setIsUploading(false);
            setUploadSuccess(true);

            const resumo = Object.keys(recordsPorMes).map(mes => {
              const t = recordsPorMes[mes];
              const taxa = t.jornada > 0 ? ((t.atendimento / t.jornada) * 100).toFixed(1) : "0";
              const jornadaEfetiva = t.jornada - t.bloqueado;
              const taxaComBloq = jornadaEfetiva > 0 ? ((t.atendimento / jornadaEfetiva) * 100).toFixed(1) : "0";
              return `📅 Mês ${mes}: ${taxa}% (sem bloqueios) | ${taxaComBloq}% (com bloqueios)`;
            }).join("\n");

            showNotification(
              "success",
              "Taxa de Ocupação Atualizada!",
              `A planilha foi sincronizada com sucesso para ${normalizeProfName(selectedProf)} (${importados} dias processados).`,
              resumo
            );

            onOcupacaoImport?.();
            setTimeout(() => setUploadSuccess(false), 5000);
          } catch (err: any) {
            setIsUploading(false);
            showNotification(
              "error", 
              "Falha ao Salvar Ocupação", 
              err.message || "Ocorreu um erro ao comunicar com o banco de dados.",
              "Se você estiver usando o Vercel, certifique-se de que a variável DATABASE_URL foi configurada no painel."
            );
          }
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

            const rawProf = row["Profissional"];
            const prof = normalizeProfName(rawProf);
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
      } catch (err: any) {
        console.error(err);
        setIsUploading(false);
        showNotification("error", "Erro no Formato do Arquivo", err.message || "Erro ao interpretar as colunas da planilha Excel.");
      }
    };
    reader.readAsBinaryString(file);
  };

  /**
   * Salva comissões no banco com feedback bonito
   */
  const mergeAndImport = async (novosDados: DesempenhoProfissional[]) => {
    if (novosDados.length === 0) {
      setIsUploading(false);
      showNotification("warning", "Planilha Vazia", "Nenhum registro de serviço ou comissão foi localizado neste arquivo.");
      return;
    }

    const normalized = novosDados.map(d => ({
      ...d,
      profissional: normalizeProfName(d.profissional),
    }));

    const grupos = new Map<string, { profissional: string; mesAno: string; items: DesempenhoProfissional[] }>();
    normalized.forEach(d => {
      const mesAno = getMesAno(d.data);
      const key = `${d.profissional}||${mesAno}`;
      if (!grupos.has(key)) grupos.set(key, { profissional: d.profissional, mesAno, items: [] });
      grupos.get(key)!.items.push({ ...d, mesAno } as DesempenhoProfissional);
    });

    try {
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

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Erro de conexão HTTP (${res.status})`);
        }
      }

      // Atualiza estado local mantendo os outros meses
      const gruposKeys = new Set(
        Array.from(grupos.values()).map(g => `${g.profissional}||${g.mesAno}`)
      );
      const dataPreservada = data.filter(d => !gruposKeys.has(`${d.profissional}||${getMesAno(d.data)}`));
      const mergedData = [...dataPreservada, ...normalized];
      onImport(mergedData);

      setIsUploading(false);
      setUploadSuccess(true);

      const resumo = Array.from(grupos.values())
        .map(g => `• ${g.profissional} (${g.mesAno}): ${g.items.length} itens gravados`)
        .join("\n");

      showNotification(
        "success",
        "Base de Comissões Atualizada!",
        `Os dados foram importados com sucesso para o banco de dados. Os meses anteriores importados continuam preservados intactos.`,
        resumo
      );

      setTimeout(() => setUploadSuccess(false), 5000);
    } catch (err: any) {
      console.error(err);
      setIsUploading(false);
      showNotification(
        "error",
        "Erro ao Conectar ao Banco",
        err.message || "Não foi possível salvar os registros no Supabase.",
        "Se o aplicativo estiver publicado na Vercel, certifique-se de cadastrar a variável DATABASE_URL nas configurações do projeto (Settings -> Environment Variables) e fazer um Redeploy."
      );
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
      
      {/* ── MODAL CUSTOMIZADO (BLACK & GOLD) ────────────────────────────── */}
      {modal.isOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "1rem",
          animation: "fadeIn 0.2s ease-out"
        }}>
          <div style={{
            background: "linear-gradient(145deg, #181818 0%, #0d0d0d 100%)",
            border: `1px solid ${modal.type === "success" ? "rgba(46, 204, 113, 0.4)" : modal.type === "error" ? "rgba(231, 76, 60, 0.4)" : "rgba(212, 175, 55, 0.4)"}`,
            borderRadius: "16px",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.8), 0 0 20px rgba(212, 175, 55, 0.1)",
            maxWidth: "500px",
            width: "100%",
            padding: "2rem",
            position: "relative",
          }}>
            {/* Botão fechar */}
            <button 
              onClick={closeModal}
              style={{
                position: "absolute",
                top: "1.25rem",
                right: "1.25rem",
                background: "transparent",
                border: "none",
                color: "var(--color-muted)",
                cursor: "pointer",
                padding: "0.25rem"
              }}
            >
              <X size={20} />
            </button>

            {/* Header com Ícone e Título */}
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: modal.type === "success" ? "rgba(46, 204, 113, 0.15)" : modal.type === "error" ? "rgba(231, 76, 60, 0.15)" : "rgba(212, 175, 55, 0.15)",
                color: modal.type === "success" ? "#2ecc71" : modal.type === "error" ? "#e74c3c" : "#d4af37"
              }}>
                {modal.type === "success" ? <CheckCircle2 size={28} /> : <AlertCircle size={28} />}
              </div>
              <div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff", margin: 0 }}>{modal.title}</h3>
                <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", color: modal.type === "success" ? "#2ecc71" : modal.type === "error" ? "#e74c3c" : "#d4af37", fontWeight: 600 }}>
                  {modal.type === "success" ? "Operação Concluída" : modal.type === "error" ? "Atenção Requerida" : "Aviso de Validação"}
                </span>
              </div>
            </div>

            {/* Mensagem Principal */}
            <p style={{ color: "#d1d1d1", fontSize: "0.95rem", lineHeight: "1.5", marginBottom: modal.details ? "1rem" : "1.5rem" }}>
              {modal.message}
            </p>

            {/* Caixa de Detalhes Adicionais (se houver) */}
            {modal.details && (
              <pre style={{
                background: "rgba(0, 0, 0, 0.4)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "8px",
                padding: "0.85rem 1rem",
                color: "#e0e0e0",
                fontSize: "0.85rem",
                whiteSpace: "pre-wrap",
                fontFamily: "sans-serif",
                marginBottom: "1.5rem",
                maxHeight: "150px",
                overflowY: "auto"
              }}>
                {modal.details}
              </pre>
            )}

            {/* Botão de Ação */}
            <button
              onClick={closeModal}
              style={{
                width: "100%",
                padding: "0.85rem",
                borderRadius: "8px",
                border: "none",
                fontWeight: 700,
                fontSize: "0.95rem",
                cursor: "pointer",
                background: modal.type === "success" 
                  ? "linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)" 
                  : modal.type === "error" 
                  ? "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)" 
                  : "linear-gradient(135deg, #d4af37 0%, #aa8c2c 100%)",
                color: "#fff",
                boxShadow: "0 4px 15px rgba(0,0,0,0.3)"
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL DE CONFIRMAÇÃO DE EXCLUSÃO ───────────────────────── */}
      {confirmDelete && (
        <div style={{
          position: "fixed", inset: 0,
          backgroundColor: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 10000, padding: "1rem"
        }}>
          <div style={{
            background: "linear-gradient(145deg, #1a0a0a 0%, #0d0505 100%)",
            border: "1px solid rgba(231, 76, 60, 0.5)",
            borderRadius: "16px",
            boxShadow: "0 20px 50px rgba(0,0,0,0.9), 0 0 25px rgba(231,76,60,0.15)",
            maxWidth: "460px", width: "100%", padding: "2rem", textAlign: "center"
          }}>
            <div style={{
              width: "64px", height: "64px", borderRadius: "50%",
              background: "rgba(231, 76, 60, 0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 1.25rem", border: "2px solid rgba(231,76,60,0.4)"
            }}>
              <AlertCircle size={32} color="#e74c3c" />
            </div>
            <h3 style={{ color: "#fff", fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>Confirmar Exclusão</h3>
            <p style={{ color: "#d1d1d1", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
              Você está prestes a excluir <strong style={{ color: "#e74c3c" }}>todos os registros</strong> de<br />
              <strong style={{ color: "#fff" }}>{deleteProf}</strong> no mês <strong style={{ color: "#fff" }}>{deleteMes}</strong>.<br />
              <span style={{ fontSize: "0.85rem", color: "#888" }}>Esta ação não pode ser desfeita.</span>
            </p>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  flex: 1, padding: "0.85rem", borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.05)", color: "#d1d1d1",
                  fontWeight: 600, cursor: "pointer"
                }}
              >
                Cancelar
              </button>
              <button
                onClick={deleteData}
                style={{
                  flex: 1, padding: "0.85rem", borderRadius: "8px", border: "none",
                  background: "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)",
                  color: "#fff", fontWeight: 700, cursor: "pointer",
                  boxShadow: "0 4px 15px rgba(231,76,60,0.3)"
                }}
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── GERENCIAR BASE DE DADOS ──────────────────────────────────── */}
      <div className="card" style={{ padding: "1.5rem", background: "linear-gradient(135deg, rgba(20,8,8,1) 0%, rgba(15,10,10,1) 100%)", border: "1px solid rgba(231, 76, 60, 0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(231,76,60,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AlertCircle size={18} color="#e74c3c" />
          </div>
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>Gerenciar Base de Dados</h3>
            <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", margin: 0 }}>Selecione um profissional e mês para excluir os registros do banco</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          {/* Select Profissional */}
          <div style={{ flex: 1, minWidth: "160px" }}>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--color-muted)", marginBottom: "0.4rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Profissional</label>
            <select
              value={deleteProf}
              onChange={e => { setDeleteProf(e.target.value); setDeleteMes(""); }}
              style={{ width: "100%", padding: "0.75rem", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(231,76,60,0.25)", borderRadius: "6px", color: "white", outline: "none", fontSize: "0.9rem" }}
            >
              <option value="">Selecione...</option>
              {["Henrique Botelho", "Tiago", "Bruna", "Wallacy", "Vanessa"].map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Select Mês */}
          <div style={{ flex: 1, minWidth: "140px" }}>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--color-muted)", marginBottom: "0.4rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Mês / Ano</label>
            <select
              value={deleteMes}
              onChange={e => setDeleteMes(e.target.value)}
              disabled={!deleteProf}
              style={{ width: "100%", padding: "0.75rem", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(231,76,60,0.25)", borderRadius: "6px", color: deleteProf ? "white" : "#888", outline: "none", fontSize: "0.9rem", opacity: deleteProf ? 1 : 0.5 }}
            >
              <option value="">{deleteProf ? (mesesDisponiveis.length > 0 ? "Selecione o mês..." : "Nenhum mês encontrado") : "Primeiro selecione o profissional"}</option>
              {mesesDisponiveis.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Botão Excluir */}
          <button
            onClick={() => {
              if (!deleteProf || !deleteMes) {
                showNotification("warning", "Seleção Incompleta", "Selecione o profissional e o mês que deseja excluir antes de continuar.");
                return;
              }
              setConfirmDelete(true);
            }}
            disabled={isDeleting || !deleteProf || !deleteMes}
            style={{
              padding: "0.75rem 1.5rem",
              background: isDeleting ? "rgba(231,76,60,0.3)" : "linear-gradient(135deg, rgba(231,76,60,0.9) 0%, rgba(192,57,43,0.9) 100%)",
              color: "#fff", border: "1px solid rgba(231,76,60,0.4)",
              borderRadius: "6px", fontWeight: 700, cursor: (!deleteProf || !deleteMes || isDeleting) ? "not-allowed" : "pointer",
              opacity: (!deleteProf || !deleteMes) ? 0.5 : 1,
              transition: "all 0.2s", whiteSpace: "nowrap",
              display: "flex", alignItems: "center", gap: "0.5rem"
            }}
          >
            {isDeleting ? (
              <><div style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} /> Excluindo...</>
            ) : (
              <>🗑️ Excluir Mês</>
            )}
          </button>
        </div>

        {/* Info visual do que será deletado */}
        {deleteProf && deleteMes && (
          <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", background: "rgba(231,76,60,0.08)", border: "1px solid rgba(231,76,60,0.2)", borderRadius: "8px", fontSize: "0.85rem", color: "#e0e0e0" }}>
            ⚠️ Serão excluídos <strong style={{ color: "#e74c3c" }}>todos os registros de comissão</strong> de <strong>{deleteProf}</strong> referentes a <strong>{deleteMes}</strong>.
          </div>
        )}
      </div>

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
