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
