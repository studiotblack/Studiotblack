// Extrai o valor monetário de um texto (legenda ou texto reconhecido por OCR de um
// comprovante). Comprovantes de Pix/banco costumam ter várias vezes o mesmo valor
// destacado (ex: "R$ 45,00" no topo e de novo no resumo) — pegar o maior valor
// encontrado é uma heurística simples que funciona bem na prática pra esse tipo de imagem.
export function extrairValor(texto: string): number | null {
  if (!texto) return null;
  // "R$" precisa aparecer de fato — sem isso, qualquer sequência solta no formato X,XX
  // no texto (um CNPJ mascarado ou ID de transação mal lido pelo OCR, por exemplo) virava
  // candidato a valor, e a heurística do maior acabava escolhendo um número que nunca foi
  // um valor monetário.
  const matches = texto.match(/R\$\s?(\d{1,3}(?:\.\d{3})*,\d{2})/gi);
  if (!matches || matches.length === 0) return null;

  const valores = matches
    .map((m) => parseFloat(m.replace(/[^\d,]/g, "").replace(",", ".")))
    .filter((v) => !isNaN(v) && v > 0);

  if (valores.length === 0) return null;
  return Math.max(...valores);
}

// Reconhece o padrão "Nx R$valor" (ex: "3x R$105,36", comum em comprovantes de compra
// parcelada) — precisa casar parcela e valor JUNTOS na mesma ocorrência, porque
// `extrairValor` sozinho pegaria o maior "R$" do texto (o TOTAL da compra), que não é o
// valor que efetivamente debita por mês.
export function extrairParcelas(texto: string): { parcelas: number; valorParcela: number } | null {
  if (!texto) return null;
  const match = texto.match(/(\d{1,2})\s*x\s*R\$\s?(\d{1,3}(?:\.\d{3})*,\d{2})/i);
  if (!match) return null;
  const parcelas = parseInt(match[1], 10);
  const valorParcela = parseFloat(match[2].replace(/\./g, "").replace(",", "."));
  if (!parcelas || parcelas < 1 || isNaN(valorParcela) || valorParcela <= 0) return null;
  return { parcelas, valorParcela };
}

// Marcação manual (por escolha do usuário) de que um comprovante é uma compra no cartão de
// crédito — não dá pra confiar em detecção automática porque um comprovante comum de Pix
// não tem como se distinguir de forma confiável. Comparação sem acento/maiúscula, então
// "cartão", "Cartão", "#cartao", "compra no cartao" etc. todos batem.
export function ehComprovanteCartao(legenda: string | null | undefined): boolean {
  if (!legenda) return false;
  const semAcento = legenda.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return semAcento.toLowerCase().includes("cartao");
}
