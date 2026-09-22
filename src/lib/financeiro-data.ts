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
  regraEntradaValorMaximo?: number | null;

  // Regra de classificação automática de saída (fallback quando o dicionário de
  // palavras-chave do comprovante do WhatsApp não reconhece nada)
  regraSaidaAtiva?: boolean;
  regraSaidaContatoId?: string;
  regraSaidaCategoriaId?: string;
  regraSaidaCentroCustoId?: string;

  // Cache do saldo real puxado do Sicoob na última sincronização
  saldoSicoob?: number;
  saldoSicoobAtualizadoEm?: string;

  // Dia do mês em que a fatura do cartão dessa conta fecha/debita (ex: 22) — usado só pra
  // calcular em qual ciclo de fatura cada parcela de uma compra no cartão cai.
  cartaoDiaVencimento?: number;
}

// Uma parcela de uma compra no cartão de crédito, marcada manualmente (legenda "cartao" no
// comprovante do WhatsApp) — acumulada aqui até o dia em que a fatura inteira (soma de
// várias compras) aparece como UMA saída só no extrato, quando aí sim é confirmada e vira
// um LancamentoFinanceiro de verdade.
export interface CompraCartaoCredito {
  id: string;
  whatsappComprovanteId?: string | null;
  contaBancariaId?: string | null;
  descricao?: string | null;
  valorParcela: number;
  parcelaNumero: number;
  parcelaTotal: number;
  mesReferencia: string; // "MM/YYYY"
  status: "pendente" | "baixado";
  lancamentoId?: string | null;
  createdAt?: string;
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

  // "Palpite" aprendido em conciliações manuais anteriores (RegraConciliacaoBancaria) —
  // reconhece a descrição do banco e já sugere o contato também, não só a categoria.
  contatoSugeridoId?: string;
  contatoSugeridoNome?: string;
  centroCustoSugeridoId?: string;

  // Legenda do comprovante do WhatsApp já REALMENTE vinculado a essa transação (diferente
  // de comprovanteLegenda, que é só o palpite de sugestão pra quem ainda está pendente).
  // Presente = essa transação foi conciliada a partir de um comprovante do WhatsApp.
  comprovanteWhatsappLegenda?: string | null;

  // Categoria já atribuída ao lançamento conciliado (null/undefined = ainda sem categoria,
  // caso comum de um match automático via WhatsApp sem palavra-chave reconhecida).
  lancamentoCategoriaId?: string | null;
  lancamentoCategoriaNome?: string | null;
  // Contato já atribuído ao lançamento conciliado — usado como contatoId ao criar uma regra
  // de conciliação bancária aprendida a partir de uma transação já vinculada.
  lancamentoContatoId?: string | null;
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
  recorrencia?: "semanal" | "mensal" | null;
  categoriaId?: string;
  categoriaNome?: string;
  centroCustoId?: string;
  centroCustoNome?: string;
  createdAt?: string;
  updatedAt?: string;

  // Série (recorrência indefinida ou parcelamento fechado) — serieId presente indica que
  // esse lançamento é uma ocorrência de uma LancamentoSerie, não avulso. serieParcelaTotal
  // nulo = recorrência sem fim definido (aluguel); número = parcelamento fechado (3x, 12x).
  serieId?: string | null;
  parcelaNumero?: number | null;
  serieParcelaTotal?: number | null;
  serieAtiva?: boolean | null;
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

// Extrai o trecho de "descricaoComplementar" que identifica a contraparte do Pix (nome ou
// documento) — formato do Sicoob é "Pagamento Pix|@<contraparte>|@...". É isso que se repete
// entre pagamentos pro MESMO lugar; a descrição genérica do banco ("PIX EMITIDO OUTRA IF")
// é idêntica pra qualquer Pix enviado e não serve pra reconhecer o destinatário.
export function extrairContraparte(descricaoComplementar?: string | null): string {
  if (!descricaoComplementar) return "";
  const partes = descricaoComplementar.split("|@").map((p) => p.trim()).filter(Boolean);
  return partes[1] || "";
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

// Agrupamento por urgência de vencimento pra tela de Contas a Pagar/Receber — em vez de
// uma tabela plana com um toggle "esta semana" que esconde tudo o resto, o padrão é
// mostrar sempre, organizado por quão urgente cada conta é. Quitados nunca entram nos
// baldes de data — viram um grupo próprio, só histórico, sem destaque nenhum.
export type BucketAgendamento = "vencido" | "estaSemana" | "esteMes" | "futuro" | "semData" | "quitado";

export function bucketAgendamento(a: Pick<Agendamento, "valor" | "valorPago" | "dataVencimento">): BucketAgendamento {
  if (statusAgendamento(a) === "pago") return "quitado";
  if (!a.dataVencimento) return "semData";
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = new Date(a.dataVencimento + "T00:00:00");
  if (vencimento < hoje) return "vencido";
  const diaSemana = hoje.getDay(); // 0=domingo
  const fimSemana = new Date(hoje);
  fimSemana.setDate(hoje.getDate() + (6 - diaSemana));
  fimSemana.setHours(23, 59, 59, 999);
  if (vencimento <= fimSemana) return "estaSemana";
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  fimMes.setHours(23, 59, 59, 999);
  if (vencimento <= fimMes) return "esteMes";
  return "futuro";
}

export function diasEmAtraso(dataVencimento: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = new Date(dataVencimento + "T00:00:00");
  return Math.max(0, Math.round((hoje.getTime() - vencimento.getTime()) / 86_400_000));
}

export const BUCKET_ORDEM: BucketAgendamento[] = ["vencido", "estaSemana", "esteMes", "futuro", "semData", "quitado"];

export const BUCKET_LABELS: Record<BucketAgendamento, string> = {
  vencido: "Vencidos",
  estaSemana: "Esta semana",
  esteMes: "Este mês",
  futuro: "Futuro",
  semData: "Sem vencimento",
  quitado: "Quitados",
};

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
