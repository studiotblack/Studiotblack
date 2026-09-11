// Descrições que o próprio Sicoob usa como rótulo GENÉRICO de um TIPO inteiro de transação
// (liquidação de boleto, Pix enviado/recebido por outra instituição, antecipação de cartão)
// — não identificam nenhuma contraparte específica, então uma "regra aprendida" guardada só
// com esse texto casa com QUALQUER transação futura do mesmo tipo, de qualquer origem.
//
// Já causou dano real em produção: uma regra aprendida em cima de "déb.tit.compe efetivado"
// (aprendida uma vez ao conciliar manualmente a compra de uma lixeira elétrica) recategorizou
// automaticamente uma transação completamente diferente (lavagem de toalhas) como "Pagamento
// Lixeira Eletrica" só porque as duas compartilhavam esse mesmo rótulo genérico do banco —
// sem nenhuma relação real entre elas. Nunca deixar essas descrições virarem gatilho de
// conciliação automática sozinha (sem confirmação manual).
export const DESCRICOES_GENERICAS_BANCO = [
  "déb.tit.compe efetivado",
  "pix emitido outra if",
  "pix recebido - outra if",
  "cr antecipação visa",
  "cr antecipação mastercard",
  "déb.conv.demais empresas",
];

export function regraEhGenericaDemais(padraoDescricao: string): boolean {
  return DESCRICOES_GENERICAS_BANCO.includes(padraoDescricao.toLowerCase().trim());
}
