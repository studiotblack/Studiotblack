// Compara o nome de um contato (conta a pagar) com o texto de um comprovante (OCR do
// WhatsApp). Usado como TRAVA na conciliação automática: valor + data iguais não bastam
// quando há contas recorrentes de mesmo valor com favorecidos diferentes (ex.: 19/10/2026 um
// Pix de R$ 1.500 pra "Gestão" casou com o lembrete de R$ 1.500 da Fabro Contabilidade).

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ");

// Palavras que aparecem em qualquer razão social e não identificam ninguém
const GENERICAS = new Set(["ltda", "eireli", "epp", "sa", "me", "mei", "de", "da", "do", "dos", "das", "e", "comercio", "servicos", "pf", "cpf", "cnpj"]);

function tokens(nome: string): string[] {
  return normalizar(nome).split(/\s+/).filter((t) => t.length >= 3 && !GENERICAS.has(t));
}

// true  → o contato aparece no comprovante (ou não dá pra comparar: contato sem nome útil)
// false → nenhuma palavra do nome do contato aparece no texto do comprovante
export function contatoApareceNoComprovante(contatoNome: string | null | undefined, textoOcr: string | null | undefined): boolean {
  const palavras = tokens(contatoNome ?? "");
  if (palavras.length === 0 || !textoOcr) return true;
  const texto = normalizar(textoOcr);
  return palavras.some((p) => texto.includes(p));
}
