import type { Sql } from "@/lib/financeiro-db";

// Primeira data (>= dataCompra) em que o dia-do-mês bate com o vencimento da fatura — é o
// ciclo em que a parcela 1 vai debitar. Parcelas seguintes somam 1 mês cada.
export function primeiraOcorrenciaFatura(dataCompra: Date, diaVencimento: number): Date {
  const candidato = new Date(dataCompra.getFullYear(), dataCompra.getMonth(), diaVencimento);
  return candidato >= dataCompra ? candidato : new Date(dataCompra.getFullYear(), dataCompra.getMonth() + 1, diaVencimento);
}

export function mesReferenciaDe(base: Date, offsetMeses: number): string {
  const d = new Date(base.getFullYear(), base.getMonth() + offsetMeses, 1);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// Grava as N parcelas de uma compra no cartão na "caixinha" (CompraCartaoCredito), pra
// reconciliar com a fatura depois. Usado tanto no fluxo automático (comprovante marcado
// com "cartao" na legenda do WhatsApp) quanto no manual (marcar depois, pela tela de
// Conciliação, quando a legenda não veio certa ou o OCR não leu o valor sozinho).
export async function registrarParcelasCartao(sql: Sql, params: {
  whatsappComprovanteId: string | null;
  descricao: string | null;
  dataCompra: Date;
  parcelas: number;
  valorParcela: number;
}) {
  const contasComCartao = await sql`SELECT id, "cartaoDiaVencimento" FROM "ContaBancaria" WHERE "cartaoDiaVencimento" IS NOT NULL`;
  const contaCartaoUnica = contasComCartao.length === 1 ? contasComCartao[0] : null;
  const primeiraParcela = contaCartaoUnica
    ? primeiraOcorrenciaFatura(params.dataCompra, contaCartaoUnica.cartaoDiaVencimento)
    : params.dataCompra;

  for (let p = 1; p <= params.parcelas; p++) {
    await sql`
      INSERT INTO "CompraCartaoCredito"
        ("whatsappComprovanteId", "contaBancariaId", descricao, "valorParcela", "parcelaNumero", "parcelaTotal", "mesReferencia")
      VALUES
        (${params.whatsappComprovanteId}, ${contaCartaoUnica?.id ?? null}, ${params.descricao}, ${params.valorParcela}, ${p}, ${params.parcelas}, ${mesReferenciaDe(primeiraParcela, p - 1)})
    `;
  }
}
