// Mock data for Black Gestão — Studio T' Black
// PARCEIROS OFICIAIS: Bruna (Estética), Wallacy (Barbeiro), Henrique (Barbeiro), Vanessa (Cabeleireira), Tiago (Barbeiro)

export const colaboradores = [
  { id: "c1", nome: "Bruna",    cargo: "Estética",     cor: "#d4b896", comissaoPercent: 60, ativo: true, telefone: "", agendamentos: 0, receitaMes: 0 },
  { id: "c2", nome: "Wallacy",  cargo: "Barbeiro",     cor: "#c9a96e", comissaoPercent: 35, ativo: true, telefone: "", agendamentos: 0, receitaMes: 0 },
  { id: "c3", nome: "Henrique", cargo: "Barbeiro",     cor: "#e8c99a", comissaoPercent: 35, ativo: true, telefone: "", agendamentos: 0, receitaMes: 0 },
  { id: "c4", nome: "Vanessa",  cargo: "Cabeleireira", cor: "#b5936a", comissaoPercent: 35, ativo: true, telefone: "", agendamentos: 0, receitaMes: 0 },
  { id: "c5", nome: "Tiago",    cargo: "Barbeiro",     cor: "#a07850", comissaoPercent: 35, ativo: true, telefone: "", agendamentos: 0, receitaMes: 0 },
];

export const clientes: {
  id: string; nome: string; telefone: string; email: string;
  totalVisitas: number; ultimaVisita: string; totalGasto: number; servicoFavorito: string;
}[] = [];

export const servicos = [
  { id: "s1",  nome: "Acabamento (pezinho)",                                    categoria: "Barbeiro",      preco: 20,   duracao: 20,  comissaoPercent: 35, ativo: true, totalRealizado: 0 },
  { id: "s2",  nome: "Avaliação/Coloração",                                     categoria: "Cabeleireira",  preco: 400,  duracao: 20,  comissaoPercent: 35, ativo: true, totalRealizado: 0 },
  { id: "s3",  nome: "Avaliação/Mechas ( FEMININA )",                           categoria: "Cabeleireira",  preco: 550,  duracao: 20,  comissaoPercent: 35, ativo: true, totalRealizado: 0 },
  { id: "s4",  nome: "Avaliação/Mechas ( MASCULINA)",                           categoria: "Barbeiro",      preco: 300,  duracao: 20,  comissaoPercent: 35, ativo: true, totalRealizado: 0 },
  { id: "s5",  nome: "Avaliação/Tratamento Capilar ( Masculina e Feminina )",   categoria: "Ambos",         preco: 0,    duracao: 20,  comissaoPercent: 40, ativo: true, totalRealizado: 0 },
  { id: "s6",  nome: "Avaliação/Coloração retoque de raiz",                     categoria: "Cabeleireira",  preco: 160,  duracao: 20,  comissaoPercent: 35, ativo: true, totalRealizado: 0 },
  { id: "s7",  nome: "Barba",                                                   categoria: "Barbeiro",      preco: 60,   duracao: 40,  comissaoPercent: 35, ativo: true, totalRealizado: 0 },
  { id: "s8",  nome: "Barba e depilação",                                       categoria: "Barbeiro",      preco: 90,   duracao: 40,  comissaoPercent: 35, ativo: true, totalRealizado: 0 },
  { id: "s9",  nome: "Brown Lamination",                                        categoria: "Estética",      preco: 120,  duracao: 80,  comissaoPercent: 60, ativo: true, totalRealizado: 0 },
  { id: "s10", nome: "Cílios/ Volume Brasileiro",                               categoria: "Estética",      preco: 150,  duracao: 120, comissaoPercent: 60, ativo: true, totalRealizado: 0 },
  { id: "s11", nome: "Corte afro e cacheado com finalização (MASCULINO)",       categoria: "Barbeiro",      preco: 75,   duracao: 40,  comissaoPercent: 35, ativo: true, totalRealizado: 0 },
  { id: "s12", nome: "Corte Afro/Cacheado. Primeira vez (MASCULINO)",           categoria: "Barbeiro",      preco: 85,   duracao: 40,  comissaoPercent: 35, ativo: true, totalRealizado: 0 },
  { id: "s13", nome: "Corte e Barba",                                           categoria: "Barbeiro",      preco: 105,  duracao: 60,  comissaoPercent: 35, ativo: true, totalRealizado: 0 },
  { id: "s14", nome: "Corte e Barba Tiago",                                     categoria: "Barbeiro",      preco: 135,  duracao: 60,  comissaoPercent: 35, ativo: true, totalRealizado: 0 },
  { id: "s15", nome: "Corte e Depilação  (MASCULINO)",                          categoria: "Barbeiro",      preco: 90,   duracao: 40,  comissaoPercent: 35, ativo: true, totalRealizado: 0 },
  { id: "s16", nome: "Corte e Hidratação (FEMININO)",                           categoria: "Cabeleireira",  preco: 270,  duracao: 100, comissaoPercent: 35, ativo: true, totalRealizado: 0 },
  { id: "s17", nome: "Corte e Sobrancelha ( MASCULINO)",                        categoria: "Barbeiro",      preco: 80,   duracao: 40,  comissaoPercent: 35, ativo: true, totalRealizado: 0 },
  { id: "s18", nome: "Corte feminino",                                          categoria: "Cabeleireira",  preco: 150,  duracao: 60,  comissaoPercent: 35, ativo: true, totalRealizado: 0 },
  { id: "s19", nome: "Corte Masculino",                                         categoria: "Barbeiro",      preco: 60,   duracao: 40,  comissaoPercent: 35, ativo: true, totalRealizado: 0 },
  { id: "s20", nome: "Cílios/ Clássico",                                        categoria: "Estética",      preco: 160,  duracao: 120, comissaoPercent: 60, ativo: true, totalRealizado: 0 },
  { id: "s21", nome: "Cílios/ Efeito Fox",                                      categoria: "Estética",      preco: 175,  duracao: 120, comissaoPercent: 60, ativo: true, totalRealizado: 0 },
  { id: "s22", nome: "Cílios/ Efeito Sirena",                                   categoria: "Estética",      preco: 120,  duracao: 140, comissaoPercent: 60, ativo: true, totalRealizado: 0 },
  { id: "s23", nome: "Cílios/ Lash Lifting",                                    categoria: "Estética",      preco: 120,  duracao: 80,  comissaoPercent: 60, ativo: true, totalRealizado: 0 },
  { id: "s24", nome: "Cílios/ Volume Egípcio",                                  categoria: "Estética",      preco: 175,  duracao: 120, comissaoPercent: 60, ativo: true, totalRealizado: 0 },
  { id: "s25", nome: "Depilação ( ORELHA E NASAL)",                             categoria: "Barbeiro",      preco: 40,   duracao: 20,  comissaoPercent: 35, ativo: true, totalRealizado: 0 },
  { id: "s26", nome: "Design com Henna/ Tintura",                               categoria: "Estética",      preco: 50,   duracao: 40,  comissaoPercent: 60, ativo: true, totalRealizado: 0 },
  { id: "s27", nome: "Design de Sobrancelhas",                                  categoria: "Estética",      preco: 40,   duracao: 20,  comissaoPercent: 60, ativo: true, totalRealizado: 0 },
  { id: "s28", nome: "Hidratação Feminina",                                     categoria: "Cabeleireira",  preco: 120,  duracao: 80,  comissaoPercent: 35, ativo: true, totalRealizado: 0 },
  { id: "s29", nome: "Hidratação masculina",                                    categoria: "Barbeiro",      preco: 80,   duracao: 40,  comissaoPercent: 35, ativo: true, totalRealizado: 0 },
  { id: "s30", nome: "Lavar e finalizar (FEMININO)",                            categoria: "Cabeleireira",  preco: 65,   duracao: 60,  comissaoPercent: 35, ativo: true, totalRealizado: 0 },
  { id: "s31", nome: "Lavar e Finalizar (MASCULINO)",                           categoria: "Barbeiro",      preco: 35,   duracao: 40,  comissaoPercent: 35, ativo: true, totalRealizado: 0 },
  { id: "s32", nome: "Limpeza de Pele",                                         categoria: "Estética",      preco: 180,  duracao: 120, comissaoPercent: 60, ativo: true, totalRealizado: 0 },
  { id: "s33", nome: "Manutenção dos Cílios",                                   categoria: "Estética",      preco: 100,  duracao: 100, comissaoPercent: 60, ativo: true, totalRealizado: 0 },
  { id: "s34", nome: "Manutenção taperedcut (FEMININO)",                        categoria: "Cabeleireira",  preco: 85,   duracao: 40,  comissaoPercent: 35, ativo: true, totalRealizado: 0 },
  { id: "s35", nome: "Remoção/ Cílios",                                         categoria: "Estética",      preco: 40,   duracao: 20,  comissaoPercent: 60, ativo: true, totalRealizado: 0 },
  { id: "s36", nome: "Sobrancelha ( Masculina)",                                categoria: "Barbeiro",      preco: 20,   duracao: 20,  comissaoPercent: 40, ativo: true, totalRealizado: 0 },
  { id: "s37", nome: "Taperedcut Primeira Vez (FEMININO)",                      categoria: "Cabeleireira",  preco: 130,  duracao: 60,  comissaoPercent: 35, ativo: true, totalRealizado: 0 },
];

export const produtos: {
  id: string; nome: string; marca: string; categoria: string;
  precoCompra: number; precoVenda: number; estoqueAtual: number;
  estoqueMinimo: number; unidade: string;
}[] = [];

export const agendamentosHoje: {
  id: string; hora: string; cliente: string; colaborador: string;
  corColab: string; servico: string; duracao: number; status: string; valor: number;
}[] = [];

export const receitaDiaria: { data: string; receita: number; despesa: number }[] = [];

export const movimentosFinanceiros: {
  id: string; tipo: string; categoria: string; descricao: string;
  valor: number; data: string; pagamento: string;
}[] = [];

export const kpisDashboard = {
  receitaHoje: 0,
  receitaMes: 0,
  receitaMesAnterior: 0,
  agendamentosHoje: 0,
  agendamentosConcluidos: 0,
  clientesAtivos: 0,
  novosClientesMes: 0,
  ticketMedio: 0,
  taxaOcupacao: 0,
  produtosBaixoEstoque: 0,
};

export const horariosAgenda = [
  "08:00","08:30","09:00","09:30","10:00","10:30",
  "11:00","11:30","12:00","12:30","13:00","13:30",
  "14:00","14:30","15:00","15:30","16:00","16:30",
  "17:00","17:30","18:00","18:30","19:00","19:30",
];
