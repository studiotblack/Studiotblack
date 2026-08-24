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

  // Credenciais Sicoob (mTLS) — presença de sicoobClientId indica que a conta está conectada
  sicoobClientId?: string;
  sicoobCertificado?: string;
  sicoobChavePrivada?: string;
  sicoobNumeroConta?: string;

  // Regra de classificação automática de créditos sem baixa correspondente
  regraEntradaAtiva?: boolean;
  regraEntradaContatoId?: string;
  regraEntradaCategoriaId?: string;
  regraEntradaCentroCustoId?: string;

  // Regra de classificação automática de saída (fallback quando o dicionário de
  // palavras-chave do comprovante do WhatsApp não reconhece nada)
  regraSaidaAtiva?: boolean;
  regraSaidaContatoId?: string;
  regraSaidaCategoriaId?: string;
  regraSaidaCentroCustoId?: string;

  // Cache do saldo real puxado do Sicoob na última sincronização
  saldoSicoob?: number;
  saldoSicoobAtualizadoEm?: string;
}

export type StatusTransacaoBancaria = "pendente" | "conciliado" | "ignorado";

export interface TransacaoBancariaImportada {
  id: string;
  contaBancariaId: string;
  idTransacaoSicoob?: string;
  data: string; // YYYY-MM-DD
  hora?: string;
  valor: number;
  tipo: "entrada" | "saida";
  descricao?: string;
  descricaoComplementar?: string;
  status: StatusTransacaoBancaria;
  lancamentoId?: string;
  lancamentoDescricao?: string; // preenchido via join, só quando conciliado
  createdAt?: string;

  // Sugestão automática a partir de um comprovante do WhatsApp com valor/data compatível
  // (mesmo sem ter sido conciliado automaticamente) — usada pra pré-preencher a
  // conciliação manual, quando a saída não teve match perfeito.
  comprovanteLegenda?: string;
  categoriaSugeridaId?: string;
  categoriaSugeridaNome?: string;
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
  dataVencimento: string | null;
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
  // Contas com valor 0 são placeholders (valor ainda não conhecido) — nunca "quitadas" sozinhas.
  if (a.valor <= 0) return "aberto";
  const quitado = a.valorPago >= a.valor;
  if (quitado) return "pago";
  // Sem data de vencimento definida ainda: fica em aberto, nunca "vencido" (não tem como
  // vencer um prazo que não existe) — o usuário vai preenchendo a data aos poucos.
  if (!a.dataVencimento) return a.valorPago > 0 ? "parcial" : "aberto";
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = new Date(a.dataVencimento + "T00:00:00");
  if (vencimento < hoje) return "vencido";
  return a.valorPago > 0 ? "parcial" : "aberto";
}

// Uma conta cai "nesta semana" se o vencimento estiver entre hoje e domingo (ou já vencida
// e ainda em aberto — não queremos que ela suma da lista da semana só porque passou do prazo).
export function estaNestaSemana(a: Pick<Agendamento, "valor" | "valorPago" | "dataVencimento">): boolean {
  if (statusAgendamento(a) === "pago") return false;
  if (!a.dataVencimento) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = new Date(a.dataVencimento + "T00:00:00");
  if (vencimento < hoje) return true; // vencida e ainda em aberto — precisa aparecer
  const diaSemana = hoje.getDay(); // 0=domingo
  const fimSemana = new Date(hoje);
  fimSemana.setDate(hoje.getDate() + (6 - diaSemana)); // próximo sábado (ou hoje, se já for sábado)
  fimSemana.setHours(23, 59, 59, 999);
  return vencimento <= fimSemana;
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
