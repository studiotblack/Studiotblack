export interface DesempenhoProfissional {
  id: string;
  profissional: string;
  item: string; // Serviço/Produto/Pacote
  data: string; // Formato DD/MM/YYYY HH:mm
  valorBruto: number; // Valor Item
  valorComissao: number; // Valor (que o profissional recebe)
  pagamento?: string;
  percentual?: number; // %
  cliente: string;
  pago?: boolean; // Pago = 1 ou 0 no PDF
}

export interface OcupacaoDiaria {
  data: string;
  horasDisponiveis: number;
  horasTrabalhadas: number;
}

export interface OcupacaoProfissional {
  profissional: string;
  ocupacaoDiaria: OcupacaoDiaria[];
}

export interface TaxaOcupacaoImportada {
  profissional: string;
  mesAno: string; // ex: "07/2026"
  taxaOcupacao: number; // ex: 0.1515 for 15.15%
  taxaOcupacaoComBloqueios: number; // ex: 0.1724 for 17.24%
  tempoAtendimentoStr: string; // ex: "03:55:17"
  tempoBloqueadoStr: string;
  tempoJornadaStr: string;
}

export const mockPdfData: DesempenhoProfissional[] = [];

// Catálogo Oficial de Serviços
export const catalogoServicos: Record<string, { tempo: number; comissao: number; preco: number }> = {
  "Acabamento (pezinho)": { tempo: 20, comissao: 0.35, preco: 20 },
  "Avaliação/Coloração": { tempo: 20, comissao: 0.35, preco: 400 },
  "Avaliação/Mechas ( FEMININA )": { tempo: 20, comissao: 0.35, preco: 550 },
  "Avaliação/Mechas ( MASCULINA)": { tempo: 20, comissao: 0.35, preco: 300 },
  "Avaliação/Tratamento Capilar ( Masculina e Feminina )": { tempo: 20, comissao: 0.40, preco: 0 },
  "Avaliaçõa/Coloração retoque de raiz": { tempo: 20, comissao: 0.35, preco: 160 },
  "Barba": { tempo: 40, comissao: 0.35, preco: 60 },
  "Barba e depilação": { tempo: 40, comissao: 0.35, preco: 90 },
  "Brown Lamination": { tempo: 80, comissao: 0.60, preco: 120 },
  "Cílios/ Clássico": { tempo: 120, comissao: 0.60, preco: 160 },
  "Cílios/ Efeito Fox": { tempo: 120, comissao: 0.60, preco: 175 },
  "Cílios/ Efeito Sirena": { tempo: 140, comissao: 0.60, preco: 120 },
  "Cílios/ Lash Lifting": { tempo: 80, comissao: 0.60, preco: 120 },
  "Cilios/ Volume Brasileiro": { tempo: 120, comissao: 0.60, preco: 150 },
  "Cílios/ Volume Egípcio": { tempo: 120, comissao: 0.60, preco: 175 },
  "Corte afro e cacheado com finalização (MASCULINO)": { tempo: 40, comissao: 0.35, preco: 75 },
  "Corte afro e cacheado com": { tempo: 40, comissao: 0.35, preco: 75 },
  "Corte Afro/ Cacheado.": { tempo: 40, comissao: 0.35, preco: 85 },
  "Corte Afro/Cacheado. Primeira vez (MASCULINO)": { tempo: 40, comissao: 0.35, preco: 85 },
  "Corte e Barba": { tempo: 60, comissao: 0.35, preco: 105 },
  "Corte e Barba Tiago": { tempo: 60, comissao: 0.35, preco: 135 },
  "Corte e Depilação (MASCULINO)": { tempo: 40, comissao: 0.35, preco: 90 },
  "Corte e Hidratação (FEMININO)": { tempo: 100, comissao: 0.35, preco: 270 },
  "Corte e Sobrancelha ( MASCULINO)": { tempo: 40, comissao: 0.35, preco: 80 },
  "Corte e Sobrancelha (": { tempo: 40, comissao: 0.35, preco: 80 },
  "Corte feminino": { tempo: 60, comissao: 0.35, preco: 150 },
  "Corte Masculino": { tempo: 40, comissao: 0.35, preco: 60 },
  "Depilação ( ORELHA E NASAL)": { tempo: 20, comissao: 0.35, preco: 40 },
  "Design com Henna/ Tintura": { tempo: 40, comissao: 0.60, preco: 50 },
  "Design de Sobrancelhas": { tempo: 20, comissao: 0.60, preco: 40 },
  "Hidratação Feminina": { tempo: 80, comissao: 0.35, preco: 120 },
  "Hidratação masculina": { tempo: 40, comissao: 0.35, preco: 80 },
  "Lavar e finalizar (FEMININO)": { tempo: 60, comissao: 0.35, preco: 65 },
  "Lavar e Finalizar (MASCULINO)": { tempo: 40, comissao: 0.35, preco: 35 },
  "Limpeza de Pele": { tempo: 120, comissao: 0.60, preco: 180 },
  "Manutenção dos Cílios": { tempo: 100, comissao: 0.60, preco: 100 },
  "Manutenção taperedcut (FEMININO)": { tempo: 40, comissao: 0.35, preco: 85 },
  "Remoção/ Cílios": { tempo: 20, comissao: 0.60, preco: 40 },
  "Sobrancelha ( Masculina)": { tempo: 20, comissao: 0.40, preco: 20 },
  "Taperedcut Primeira Vez (FEMININO)": { tempo: 60, comissao: 0.35, preco: 0 },
};

// Catálogo Oficial de Produtos
export interface ProdutoCatalogo {
  nome: string;
  marca: string;
  preco: number;
  comissao: number;
  estoque: number;
}

export const catalogoProdutos: ProdutoCatalogo[] = [
  { nome: "ATIVADOR DE CACHOS WS", marca: "WS", preco: 136, comissao: 0.10, estoque: 1 },
  { nome: "BALM B.URB MIDTOWN", marca: "B.URB", preco: 63, comissao: 0.10, estoque: 4 },
  { nome: "BALM B.URB UPTOWN", marca: "B.URB", preco: 63, comissao: 0.10, estoque: 5 },
  { nome: "COLORAÇÃO EM SHAMPOO CASTANHO", marca: "MIRANDA HAIR COLOR", preco: 39, comissao: 0.10, estoque: 2 },
  { nome: "COLORAÇÃO EM SHAMPOO PRETO", marca: "MIRANDA HAIR COLOR", preco: 39, comissao: 0.10, estoque: 2 },
  { nome: "CONDICIONADOR AC. CRESPO POWER", marca: "Apse", preco: 65, comissao: 0.10, estoque: 8 },
  { nome: "CONDICIONADOR ELEMENTS CACAU+AÇAI+MEL", marca: "MIRRA", preco: 89.99, comissao: 0.10, estoque: 2 },
  { nome: "CONDICIONADOR ELEMENTS MIRRA NUTRIÇÃO VEGETAL AINTI CASPA", marca: "MIRRA", preco: 89.99, comissao: 0.10, estoque: 0 },
  { nome: "CONDICIONADOR ELEMENTS TUTANO+CAVIAR", marca: "MIRRA", preco: 89.99, comissao: 0.10, estoque: 4 },
  { nome: "CONDICIONADOR WS", marca: "WS", preco: 125, comissao: 0.10, estoque: 2 },
  { nome: "CREME DE PENTEAR WS", marca: "WS", preco: 136, comissao: 0.10, estoque: 4 },
  { nome: "ELIXIR GOLD", marca: "MIRRA", preco: 80, comissao: 0.10, estoque: 0 },
  { nome: "Elixir gold 140ML", marca: "", preco: 165, comissao: 0.10, estoque: 0 },
  { nome: "ESCOVA FITAGEM", marca: "Soulta", preco: 27, comissao: 0.10, estoque: 0 },
  { nome: "ESPONJA NUDRED", marca: "", preco: 35, comissao: 0.10, estoque: 0 },
  { nome: "FRONHA CETIM STUDIO BRANCA", marca: "STUDIO", preco: 55, comissao: 0.10, estoque: 4 },
  { nome: "FRONHA CETIM STUDIO CHAMPANHE", marca: "STUDIO", preco: 55, comissao: 0.10, estoque: 0 },
  { nome: "FRONHA CETIM STUDIO PRETA", marca: "STUDIO", preco: 55, comissao: 0.10, estoque: 5 },
  { nome: "GELATINA APICE 300ML", marca: "Apse", preco: 65, comissao: 0.10, estoque: 5 },
  { nome: "GELATINA WS", marca: "WS", preco: 110, comissao: 0.10, estoque: 2 },
  { nome: "GELEIA MODELADORA RAISE", marca: "RAISE", preco: 100, comissao: 0.10, estoque: 9 },
  { nome: "GROOMING MODELADOR DE FIXAÇÃO 250G", marca: "INOVATTY", preco: 62.70, comissao: 0.10, estoque: 2 },
  { nome: "LACINHO 2 UN", marca: "TÔ LINDA", preco: 12, comissao: 0.10, estoque: 3 },
  { nome: "LACINHO CABELO", marca: "TÔ LINDA", preco: 7, comissao: 0.10, estoque: 0 },
  { nome: "LEAVE-IN ELEMENTS CACAU+AÇAI+MEL", marca: "MIRRA", preco: 89.99, comissao: 0.10, estoque: 2 },
  { nome: "LEAVE-IN ELEMENTS TUTANO+CAVIAR", marca: "MIRRA", preco: 89.99, comissao: 0.10, estoque: 2 },
  { nome: "LEAVE-IN MISS CURLS", marca: "MIRRA", preco: 42, comissao: 0.10, estoque: 2 },
  { nome: "LEAVE-IN MISS CURLS 500ML", marca: "MIRRA", preco: 170, comissao: 0.10, estoque: 0 },
  { nome: "MASCARA ACIDIFICANTE WS", marca: "WS", preco: 150, comissao: 0.10, estoque: 5 },
  { nome: "MISS CURLS CONDICIONADOR 60ML", marca: "MIRRA", preco: 42, comissao: 0.10, estoque: 1 },
  { nome: "MISS CURLS SHAMPOO 60ml", marca: "MIRRA", preco: 42, comissao: 0.10, estoque: 1 },
  { nome: "MOUSSE CRESPO POWER", marca: "Apse", preco: 95, comissao: 0.10, estoque: 1 },
  { nome: "MOUSSE MIRRA", marca: "MIRRA", preco: 130, comissao: 0.10, estoque: 1 },
  { nome: "MÁSCARA ELEMENTS CACAU+AÇAI+MEL", marca: "MIRRA", preco: 89.99, comissao: 0.10, estoque: 1 },
  { nome: "MÁSCARA ELEMENTS MIRRA NUTRIÇÃO VEGETAL ANTICASPA", marca: "MIRRA", preco: 89.99, comissao: 0.10, estoque: 1 },
  { nome: "MÁSCARA ELEMENTS TUTANO+CAVIAR", marca: "MIRRA", preco: 89.99, comissao: 0.10, estoque: 5 },
  { nome: "MÁSCARA FINALIZADORA RAISE 500ml", marca: "Raise", preco: 140, comissao: 0.10, estoque: 13 },
  { nome: "PASTA MODELADORA EFEITO BRILHO ALTA FIXAÇÃO B.URB", marca: "B.URB", preco: 80, comissao: 0.10, estoque: 2 },
  { nome: "PASTA MODELADORA EFEITO MATTE MÉDIA FIXAÇÃO B.URB", marca: "B.URB", preco: 80, comissao: 0.10, estoque: 4 },
  { nome: "PENTE escovinha", marca: "", preco: 10, comissao: 0.10, estoque: 44 },
  { nome: "PENTE GARFO", marca: "", preco: 20, comissao: 0.10, estoque: 10 },
  { nome: "PERFUME MAISON VISAGE", marca: "MAISON VISAGE ROSÂNGELA", preco: 140, comissao: 0.10, estoque: 2 },
  { nome: "SHAMPO CRESPO POWER", marca: "Apse", preco: 65, comissao: 0.10, estoque: 6 },
  { nome: "SHAMPOO ELEMENTS CACAU+AÇAI+MEL", marca: "MIRRA", preco: 89.99, comissao: 0.10, estoque: 3 },
  { nome: "SHAMPOO ELEMENTS TUTANO+CAVIAR", marca: "MIRRA", preco: 89.99, comissao: 0.10, estoque: 1 },
  { nome: "SHAMPOO LIMPESA SUAVE HIDRATANTE VERDE 500ML", marca: "Raise", preco: 78, comissao: 0.10, estoque: 6 },
  { nome: "SHAMPOO MIRRA ELEMENTS NUTRIÇÃO VEGETAL ANTI CASPA", marca: "MIRRA", preco: 89.99, comissao: 0.10, estoque: 0 },
  { nome: "SHAMPOO SEM ESPUMA CREMOSO AZUL 500 ML", marca: "Raise", preco: 84, comissao: 0.10, estoque: 4 },
  { nome: "SHAMPOO WS", marca: "WS", preco: 125, comissao: 0.10, estoque: 4 },
  { nome: "TOUCA CETIM STUDIO", marca: "STUDIO", preco: 50, comissao: 0.10, estoque: 9 },
  { nome: "TOUCA DE BANHO", marca: "ELISANGELA", preco: 70, comissao: 0.10, estoque: 1 },
  { nome: "TOUCA DE CETIM ANTIFRIZZ PARA DORMIR", marca: "Soulta", preco: 22.80, comissao: 0.10, estoque: 0 },
  { nome: "TOUCA DE CETIM DIFUSORA", marca: "Soulta", preco: 50, comissao: 0.10, estoque: 13 },
];

// Compara pela PRIMEIRA palavra do nome (não por substring solta em qualquer posição) — o nome
// completo do Tiago no AppBarber é "Tiago Henrique", então um match por .includes("henrique")
// classificava incorretamente os dados dele como sendo do Henrique Botelho.
export const normalizeProfName = (name: string): string => {
  if (!name) return "";
  const trimmed = name.trim();
  const firstWord = trimmed.toLowerCase().split(/\s+/)[0];
  if (firstWord === "henrique") return "Henrique Botelho";
  if (firstWord === "wallacy") return "Wallacy";
  if (firstWord === "tiago") return "Tiago";
  if (firstWord === "vanessa") return "Vanessa";
  if (firstWord === "bruna") return "Bruna";
  return trimmed;
};

export const getPrimeiroNome = (name: string): string => {
  if (!name) return "";
  return name.trim().split(" ")[0];
};

// ── Parsing compartilhado (usado pelo upload manual em ImportacaoDados.tsx E pelo script de automação scripts/import-watch.ts) ──

// Extrai mesAno (MM/YYYY) de uma string de data DD/MM/YYYY ou DD/MM/YYYY HH:mm
export const getMesAno = (dataStr: string): string => {
  const parts = dataStr.split("/");
  if (parts.length >= 3) return `${parts[1]}/${parts[2].substring(0, 4)}`;
  return "Geral";
};

export const parseValorBR = (val: any): number => {
  if (typeof val === "string") {
    return parseFloat(val.replace("R$", "").replace(/\./g, "").replace(",", ".").trim()) || 0;
  }
  return Number(val) || 0;
};

// Converte data serial do Excel (número de dias desde 1900) para "DD/MM/YYYY HH:mm"
export const excelSerialToDateTimeStr = (serial: number): string => {
  const dateObj = new Date((serial - (25567 + 2)) * 86400 * 1000);
  return `${String(dateObj.getDate()).padStart(2, "0")}/${String(dateObj.getMonth() + 1).padStart(2, "0")}/${dateObj.getFullYear()} 00:00`;
};

export const excelSerialToDateStr = (serial: number): string => {
  const dateObj = new Date((serial - (25567 + 2)) * 86400 * 1000);
  return `${String(dateObj.getDate()).padStart(2, "0")}/${String(dateObj.getMonth() + 1).padStart(2, "0")}/${dateObj.getFullYear()}`;
};

export const timeToMins = (t: any): number => {
  if (t === null || t === undefined || t === "") return 0;
  if (typeof t === "number") return Math.round(t * 24 * 60);
  const s = String(t).trim();
  const parts = s.split(":");
  if (parts.length >= 2) {
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
  }
  return 0;
};

export const minsToTime = (m: number): string => {
  const h = Math.floor(m / 60);
  const mins = Math.floor(m % 60);
  return `${String(h).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;
};

// Detecta se a planilha (pelas colunas) é um relatório de Taxa de Ocupação do AppBarber
export const isPlanilhaOcupacao = (keys: string[]): boolean => {
  return keys.includes("Taxa de ocupação") || keys.includes("Média de Ocupação no Período");
};

// Converte as linhas cruas da planilha de Comissões do AppBarber (xlsx.utils.sheet_to_json) em DesempenhoProfissional[]
export const parseComissoesRows = (jsonData: any[]): DesempenhoProfissional[] => {
  return jsonData
    .filter(row => row.Profissional && row.Data && !String(row.Profissional).toLowerCase().includes("total") && !String(row.Profissional).toLowerCase().includes("comissã"))
    .map((row) => {
      const valorBruto = parseValorBR(row["Valor Item"] || row["Valor"] || 0);
      const valorComissao = parseValorBR(row["Valor"] || 0);

      let dataStr = row["Data"];
      if (typeof dataStr === "number") {
        dataStr = excelSerialToDateTimeStr(dataStr);
      }

      const prof = normalizeProfName(row["Profissional"]);
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
};

export interface TotaisOcupacaoMes {
  jornada: number;
  atendimento: number;
  bloqueado: number;
}

// Agrega as linhas cruas da planilha de Taxa de Ocupação do AppBarber (uma linha por dia) em totais por mesAno
export const aggregateOcupacaoRows = (jsonData: any[]): Record<string, TotaisOcupacaoMes> => {
  const recordsPorMes: Record<string, TotaisOcupacaoMes> = {};

  jsonData.forEach(row => {
    const diaRaw = row["Dia"];
    if (!diaRaw) return;
    const diaStr = String(diaRaw).trim().toLowerCase();
    if (diaStr.includes("total") || diaStr.includes("média") || diaStr.includes("media")) return;

    let diaFormatado = diaStr;
    if (typeof diaRaw === "number") {
      diaFormatado = excelSerialToDateStr(diaRaw);
    }

    let mesAno = "Geral";
    const parts = diaFormatado.split("/");
    if (parts.length === 3) mesAno = `${parts[1]}/${parts[2]}`;
    else if (parts.length === 2) mesAno = `${parts[0]}/${parts[1]}`;

    if (!recordsPorMes[mesAno]) recordsPorMes[mesAno] = { jornada: 0, atendimento: 0, bloqueado: 0 };

    recordsPorMes[mesAno].jornada += timeToMins(row["Tempo de Jornada"]);
    recordsPorMes[mesAno].atendimento += timeToMins(row["Tempo em Atendimento"]);
    recordsPorMes[mesAno].bloqueado += timeToMins(row["Tempo Bloqueado"]);
  });

  return recordsPorMes;
};

// Converte os totais agregados de um mês em um payload pronto para POST /api/performance/ocupacao
export const buildTaxaOcupacaoPayload = (profissional: string, mesAno: string, totais: TotaisOcupacaoMes) => {
  const taxaOcup = totais.jornada > 0 ? totais.atendimento / totais.jornada : 0;
  const jornadaEfetiva = totais.jornada - totais.bloqueado;
  const taxaOcupComBloqueio = jornadaEfetiva > 0 ? totais.atendimento / jornadaEfetiva : taxaOcup;

  return {
    profissional: normalizeProfName(profissional),
    mesAno,
    taxaOcupacao: taxaOcup,
    taxaOcupacaoComBloqueios: taxaOcupComBloqueio,
    tempoAtendimentoStr: minsToTime(totais.atendimento),
    tempoBloqueadoStr: minsToTime(totais.bloqueado),
    tempoJornadaStr: minsToTime(totais.jornada),
  };
};

export const getProfissionaisUnicos = (data: DesempenhoProfissional[], ocupacao: TaxaOcupacaoImportada[] = []) => {
  const defaultProfs = ["Bruna", "Wallacy", "Henrique Botelho", "Vanessa", "Tiago"];

  const profissionais = new Set<string>();

  // Adiciona profissionais com dados de comissão importados
  data.forEach(d => {
    if (d.profissional && !d.profissional.toLowerCase().includes("total") && !d.profissional.toLowerCase().includes("comissão") && !d.profissional.toLowerCase().includes("comissao")) {
      profissionais.add(normalizeProfName(d.profissional));
    }
  });

  // Garante que profissionais com taxa de ocupação importada também apareçam
  ocupacao.forEach(t => {
    if (t.profissional) {
      profissionais.add(normalizeProfName(t.profissional));
    }
  });

  // Se nenhum dado foi importado ainda, mostra os profissionais padrão
  return profissionais.size > 0 ? Array.from(profissionais).sort() : defaultProfs;
};

export const getServicosMaisRealizados = (data: DesempenhoProfissional[]) => {
  const counts: Record<string, number> = {};
  data.forEach(d => {
    counts[d.item] = (counts[d.item] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
};

export const getTotalFaturado = (data: DesempenhoProfissional[]) => {
  return data.reduce((acc, curr) => acc + curr.valorBruto, 0);
};

export const getTotalComissao = (data: DesempenhoProfissional[]) => {
  return data.reduce((acc, curr) => acc + curr.valorComissao, 0);
};
