// Extrai o valor monetário de um texto (legenda ou texto reconhecido por OCR de um
// comprovante). Comprovantes de Pix/banco costumam ter várias vezes o mesmo valor
// destacado (ex: "R$ 45,00" no topo e de novo no resumo) — pegar o maior valor
// encontrado é uma heurística simples que funciona bem na prática pra esse tipo de imagem.
export function extrairValor(texto: string): number | null {
  if (!texto) return null;
  const matches = texto.match(/R?\$?\s?(\d{1,3}(?:\.\d{3})*,\d{2})/g);
  if (!matches || matches.length === 0) return null;

  const valores = matches
    .map((m) => parseFloat(m.replace(/[^\d,]/g, "").replace(",", ".")))
    .filter((v) => !isNaN(v) && v > 0);

  if (valores.length === 0) return null;
  return Math.max(...valores);
}
