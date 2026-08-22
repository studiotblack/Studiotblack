// ── DRE Data Layer ─────────────────────────────────────────────────────────
// Tipos, mock data e funções de cálculo — versão com 3 níveis de categoria.

export type DREGrupo =
  | "receita"
  | "custo"
  | "despesa"
  | "investimento"
  | "financiamento";

export type DREOrigem = "caixa" | "banco";

export interface DRELancamento {
  id: string;
  data: string; // "YYYY-MM-DD"
  descricao: string;
  valor: number;
  tipo: "ENTRADA" | "SAIDA";
  grupo: DREGrupo;
  subcategoria: string;
  subsubcategoria?: string; // 3º nível — ex: "Corte", "Barba"
  origem: DREOrigem;
  importadoSicoob?: boolean;
}

// Transação bancária bruta (para conciliação)
export interface BankTransaction {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: "C" | "D"; // C = crédito, D = débito
  status: "pendente" | "conciliado";
  // Categoria apontada pelo usuário na conciliação
  grupo?: DREGrupo;
  subcategoria?: string;
  subsubcategoria?: string;
}

// ── Mapa de 3 níveis (default — editável pelo usuário) ─────────────────────
export type CategoriasConfig = Record<DREGrupo, Record<string, string[]>>;

export const CATEGORIAS_DEFAULT: CategoriasConfig = {
  receita: {
    "Serviços":  ["Corte", "Barba", "Corte + Barba", "Sobrancelha", "Tintura", "Relaxamento", "Hidratação", "Outros Serviços"],
    "Produtos":  ["Pomadas", "Shampoos", "Condicionadores", "Bebidas/Bar", "Acessórios"],
    "Descontos": ["Fidelidade", "Promoção", "Cortesia", "Outros"],
  },
  custo: {
    "Comissões":  ["Comissão Serviços", "Comissão Produtos"],
    "Insumos":    ["Lâminas", "Pomada Profissional", "Tintura Profissional", "Material Descartável", "Outros"],
    "Mercadoria": ["Estoque Revenda", "Bebidas/Bar", "Acessórios Revenda"],
  },
  despesa: {
    "Aluguel":      ["Aluguel Imóvel", "Aluguel Equipamento"],
    "Salários":     ["Recepcionista", "Gerente", "Administração"],
    "Contador":     ["Honorários Contábeis"],
    "Marketing":    ["Redes Sociais/Ads", "Material Gráfico", "Eventos"],
    "Software":     ["Sistema de Gestão", "Outras Assinaturas"],
    "Treinamentos": ["Cursos", "Workshops"],
    "Tributário":   ["Simples Nacional (DAS)", "Outros Impostos"],
    "Financeiro":   ["Tarifas Bancárias", "IOF", "Outros"],
    "Regulatório":  ["Vigilância Sanitária", "Alvará", "Outros"],
  },
  investimento: {
    "Equipamentos": ["Cadeiras", "Esterilização", "Tecnologia", "Outros Equipamentos"],
    "Reformas":     ["Obra Civil", "Decoração", "Mobiliário"],
    "Consórcio":    ["Parcela Consórcio"],
  },
  financiamento: {
    "Empréstimos":       ["Parcela Bancária", "Outros"],
    "Retirada do Sócio": ["Pró-labore", "Distribuição de Lucros"],
  },
};

// Mantido para compatibilidade — lista plana de subcategorias por grupo
export const SUBCATEGORIAS: Record<DREGrupo, string[]> = {
  receita:       ["Serviços", "Produtos", "Descontos"],
  custo:         ["Comissões", "Insumos", "Mercadoria"],
  despesa:       ["Aluguel", "Salários", "Contador", "Marketing", "Software", "Treinamentos", "Tributário", "Financeiro", "Regulatório"],
  investimento:  ["Equipamentos", "Reformas", "Consórcio"],
  financiamento: ["Empréstimos", "Retirada do Sócio"],
};

export const GRUPO_LABELS: Record<DREGrupo, string> = {
  receita:       "RECEITA",
  custo:         "(-) CUSTO OPERACIONAL",
  despesa:       "(-) DESPESAS OPERACIONAIS",
  investimento:  "(-) INVESTIMENTOS",
  financiamento: "(-) FINANCIAMENTO",
};

// ── Mock Bank Transactions (para conciliação) ─────────────────────────────
export const mockBankTransactions: BankTransaction[] = [];

// ── Mock Data Inicial ───────────────────────────────────────────────────────
function ml(
  mes: number,
  grupo: DREGrupo,
  subcategoria: string,
  descricao: string,
  valor: number,
  tipo: "ENTRADA" | "SAIDA",
  origem: DREOrigem = "caixa",
  subsubcategoria?: string
): DRELancamento {
  const dia = Math.floor(Math.random() * 28) + 1;
  return {
    id: `dre-${mes}-${grupo.slice(0,3)}-${Math.random().toString(36).slice(2,6)}`,
    data: `2026-${String(mes).padStart(2,"0")}-${String(dia).padStart(2,"0")}`,
    descricao, valor, tipo, grupo, subcategoria, subsubcategoria, origem,
  };
}

export const dreLancamentosIniciais: DRELancamento[] = [];

// ── Funções de Cálculo ──────────────────────────────────────────────────────

export function getTotalByGroupAndSubcat(
  lancamentos: DRELancamento[],
  grupo: DREGrupo,
  subcategoria: string,
  mes: number
): number {
  return lancamentos
    .filter(l => {
      const lMes = parseInt(l.data.split("-")[1]);
      return l.grupo === grupo && l.subcategoria === subcategoria && lMes === mes;
    })
    .reduce((acc, l) => {
      if (l.grupo === "receita" && l.tipo === "SAIDA") return acc - l.valor;
      return acc + l.valor;
    }, 0);
}

export function getTotalBySubSub(
  lancamentos: DRELancamento[],
  grupo: DREGrupo,
  subcategoria: string,
  subsubcategoria: string,
  mes: number
): number {
  return lancamentos
    .filter(l => {
      const lMes = parseInt(l.data.split("-")[1]);
      return l.grupo === grupo
        && l.subcategoria === subcategoria
        && l.subsubcategoria === subsubcategoria
        && lMes === mes;
    })
    .reduce((acc, l) => {
      if (l.grupo === "receita" && l.tipo === "SAIDA") return acc - l.valor;
      return acc + l.valor;
    }, 0);
}

export function getTotalByGroup(
  lancamentos: DRELancamento[],
  grupo: DREGrupo,
  mes: number
): number {
  return lancamentos
    .filter(l => {
      const lMes = parseInt(l.data.split("-")[1]);
      return l.grupo === grupo && lMes === mes;
    })
    .reduce((acc, l) => {
      if (l.grupo === "receita" && l.tipo === "SAIDA") return acc - l.valor;
      return acc + l.valor;
    }, 0);
}

export function getLancamentosByGroupSubcatMes(
  lancamentos: DRELancamento[],
  grupo: DREGrupo,
  subcategoria: string,
  mes: number
): DRELancamento[] {
  return lancamentos.filter(l => {
    const lMes = parseInt(l.data.split("-")[1]);
    return l.grupo === grupo && l.subcategoria === subcategoria && lMes === mes;
  });
}

export function getLancamentosBySubSub(
  lancamentos: DRELancamento[],
  grupo: DREGrupo,
  subcategoria: string,
  subsubcategoria: string,
  mes: number
): DRELancamento[] {
  return lancamentos.filter(l => {
    const lMes = parseInt(l.data.split("-")[1]);
    return l.grupo === grupo
      && l.subcategoria === subcategoria
      && l.subsubcategoria === subsubcategoria
      && lMes === mes;
  });
}

export function getLucroBruto(lancamentos: DRELancamento[], mes: number) {
  return getTotalByGroup(lancamentos,"receita",mes) - getTotalByGroup(lancamentos,"custo",mes);
}

export function getResultadoOperacional(lancamentos: DRELancamento[], mes: number) {
  return getLucroBruto(lancamentos,mes) - getTotalByGroup(lancamentos,"despesa",mes);
}

export function getVariacaoCaixa(lancamentos: DRELancamento[], mes: number) {
  return getResultadoOperacional(lancamentos,mes)
    - getTotalByGroup(lancamentos,"investimento",mes)
    - getTotalByGroup(lancamentos,"financiamento",mes);
}

export const MESES_ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
export const MESES_FULL  = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
export const MESES = [1,2,3,4,5,6,7,8,9,10,11,12];

// ── DRE Real (importado do Excel "Realizado" do sistema contábil) ──────────
// Diferente do DRELancamento (lançamento por lançamento numa taxonomia inventada),
// isto é o DRE JÁ PRONTO como vem do relatório contábil: uma linha por conta,
// na ordem exata do arquivo, com o valor mensal já calculado. Fielmente reproduzido,
// sem reclassificar nada — é assim que o contador já entrega.

export interface DreLinhaImportada {
  ordem: number;         // posição da linha no arquivo original — preserva a ordem exata do DRE
  resultado: string;     // nome da linha: cabeçalho de grupo ("RECEITAS OPERACIONAIS") ou conta com código ("1.1.1.01.001-Venda de Serviços")
  totalAno: number;
  jan: number; fev: number; mar: number; abr: number; mai: number; jun: number;
  jul: number; ago: number; set: number; out: number; nov: number; dez: number;
}

// Linhas com código contábil (ex: "1.1.1.01.001-...") são contas de detalhe (indentadas);
// as demais são cabeçalhos de grupo ou totais calculados (em negrito, como no Excel).
export const isDreLinhaDetalhe = (resultado: string): boolean => /^\d/.test(resultado.trim());

const DRE_MESES_KEYS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"] as const;

// Converte as linhas cruas da planilha "Realizado" (xlsx.utils.sheet_to_json) pro formato acima.
// Filtra a linha de cabeçalho repetida no meio/fim do arquivo (ex: "Indicadores" com "Jan","Fev"... como texto em vez de número).
export function parseDreExcelRows(jsonData: any[]): { ano: number; linhas: Omit<DreLinhaImportada, "ordem">[] } {
  if (jsonData.length === 0) return { ano: new Date().getFullYear(), linhas: [] };
  const keys = Object.keys(jsonData[0]);
  const anoKey = keys.find(k => k !== "Resultado" && !(DRE_MESES_KEYS as readonly string[]).includes(k));
  const ano = anoKey ? (parseInt(anoKey, 10) || new Date().getFullYear()) : new Date().getFullYear();

  const linhas = jsonData
    .filter(row => row["Resultado"] && typeof row["Jan"] === "number")
    .map(row => ({
      resultado: String(row["Resultado"]).trim(),
      totalAno: anoKey ? Number(row[anoKey]) || 0 : 0,
      jan: Number(row["Jan"]) || 0,
      fev: Number(row["Fev"]) || 0,
      mar: Number(row["Mar"]) || 0,
      abr: Number(row["Abr"]) || 0,
      mai: Number(row["Mai"]) || 0,
      jun: Number(row["Jun"]) || 0,
      jul: Number(row["Jul"]) || 0,
      ago: Number(row["Ago"]) || 0,
      set: Number(row["Set"]) || 0,
      out: Number(row["Out"]) || 0,
      nov: Number(row["Nov"]) || 0,
      dez: Number(row["Dez"]) || 0,
    }));

  return { ano, linhas };
}

// Deriva os indicadores de gestão direto das linhas já calculadas pelo contador —
// sem reinventar nenhuma conta, só localiza e lê os totais que o próprio DRE já traz.
export function computeIndicadoresDre(linhas: DreLinhaImportada[]) {
  const acharTotal = (nomeExato: string) => linhas.find(l => l.resultado === nomeExato)?.totalAno ?? 0;
  const somarQueContem = (trecho: string) => linhas
    .filter(l => isDreLinhaDetalhe(l.resultado) && l.resultado.toLowerCase().includes(trecho.toLowerCase()))
    .reduce((acc, l) => acc + l.totalAno, 0);

  const receitaTotal = acharTotal("RECEITAS OPERACIONAIS");
  const resultadoOperacional = acharTotal("RESULTADO OPERACIONAL");
  const margemContribuicao = acharTotal("Margem de contribuição");
  const aluguelTotal = Math.abs(somarQueContem("alugue")); // cobre "Aluguel" e "Alugueis" (singular/plural)
  const comissoesTotal = Math.abs(somarQueContem("comiss"));

  return {
    receitaTotal,
    resultadoOperacional,
    margemContribuicao,
    aluguelTotal,
    comissoesTotal,
    pctAluguel: receitaTotal > 0 ? (aluguelTotal / receitaTotal) * 100 : 0,
    pctComissoes: receitaTotal > 0 ? (comissoesTotal / receitaTotal) * 100 : 0,
    margemOperacional: receitaTotal > 0 ? (resultadoOperacional / receitaTotal) * 100 : 0,
  };
}

const DRE_MES_CAMPOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;

// Mesma ideia do computeIndicadoresDre, mas lendo só a coluna de um mês específico
// (0 = Janeiro, ..., 11 = Dezembro) em vez do totalAno — usado no card "Receita/Lucro do Mês".
export function computeIndicadoresDreMes(linhas: DreLinhaImportada[], mesIndex: number) {
  const campo = DRE_MES_CAMPOS[mesIndex];
  const acharValorMes = (nomeExato: string) => {
    const linha = linhas.find(l => l.resultado === nomeExato);
    return linha ? (linha[campo] as number) : 0;
  };

  const receitaMes = acharValorMes("RECEITAS OPERACIONAIS");
  const resultadoOperacionalMes = acharValorMes("RESULTADO OPERACIONAL");

  return {
    receitaMes,
    resultadoOperacionalMes,
    margemOperacionalMes: receitaMes > 0 ? (resultadoOperacionalMes / receitaMes) * 100 : 0,
  };
}
