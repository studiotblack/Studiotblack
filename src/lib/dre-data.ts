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
