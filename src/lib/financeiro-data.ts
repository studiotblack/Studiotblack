// ── Financeiro Essencial — Data Layer ───────────────────────────────────────
// Tipos compartilhados entre as rotas de API e os componentes de UI do módulo
// de Contas a Pagar/Receber (substitui a taxonomia fake de dre-data.ts para
// lançamentos novos, criados manualmente no dia a dia).

export type TipoContaBancaria = "Conta corrente" | "Poupança" | "Caixa" | "Cartão";

export interface ContaBancaria {
  id: string;
  nome: string;
  banco: string;
  tipoConta: TipoContaBancaria;
  agencia?: string;
  conta?: string;
  saldoInicial: number;
  dataSaldoInicial: string; // YYYY-MM-DD
  ativa: boolean;
}

export type TipoContato = "cliente" | "fornecedor" | "funcionario" | "socio";

export interface Contato {
  id: string;
  nome: string;
  cpfCnpj?: string;
  tipos: TipoContato[];
  email?: string;
  telefone?: string;
  observacoes?: string;
  ativo: boolean;
}

export type TipoCategoria = "entrada" | "saida";

export interface CategoriaFinanceira {
  id: string;
  codigo?: string;
  grupo: string;
  categoriaPai?: string;
  nome: string;
  tipo: TipoCategoria;
}

export interface CentroCusto {
  id: string;
  nome: string;
  ativo: boolean;
}

export type TipoAgendamento = "pagar" | "receber";
export type StatusAgendamento = "aberto" | "parcial" | "pago" | "vencido";

export interface Agendamento {
  id: string;
  tipo: TipoAgendamento;
  contatoId: string;
  contatoNome?: string;
  valor: number;
  valorPago: number;
  dataVencimento: string;
  dataCompetencia: string;
  dataPrevisao?: string;
  descricao: string;
  referencia?: string;
  detalhamento?: string;
  contaBancariaId?: string;
  contaBancariaNome?: string;
  reembolsavel: boolean;
  categoriaId?: string;
  categoriaNome?: string;
  centroCustoId?: string;
  centroCustoNome?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Baixa {
  id: string;
  agendamentoId: string;
  valor: number;
  data: string;
  contaBancariaId: string;
  observacao?: string;
}

export interface Transferencia {
  id: string;
  contaOrigemId: string;
  contaDestinoId: string;
  valor: number;
  data: string;
  descricao?: string;
}

// Status é sempre calculado a partir de valor/valorPago/dataVencimento — nunca armazenado,
// pra não ficar desatualizado (ex: "vencido" tem que reagir à passagem do tempo sozinho).
export function statusAgendamento(a: Pick<Agendamento, "valor" | "valorPago" | "dataVencimento">): StatusAgendamento {
  const quitado = a.valorPago >= a.valor;
  if (quitado) return "pago";
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = new Date(a.dataVencimento + "T00:00:00");
  if (vencimento < hoje) return "vencido";
  return a.valorPago > 0 ? "parcial" : "aberto";
}

export const STATUS_LABELS: Record<StatusAgendamento, string> = {
  aberto: "Em aberto",
  parcial: "Parcialmente pago",
  pago: "Quitado",
  vencido: "Vencido",
};

export const STATUS_COLORS: Record<StatusAgendamento, string> = {
  aberto: "var(--color-info)",
  parcial: "var(--color-warning)",
  pago: "var(--color-success)",
  vencido: "var(--color-danger)",
};

export const TIPOS_CONTATO_LABELS: Record<TipoContato, string> = {
  cliente: "Cliente",
  fornecedor: "Fornecedor",
  funcionario: "Funcionário",
  socio: "Sócio",
};
