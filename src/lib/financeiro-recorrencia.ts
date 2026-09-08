// Helpers de data compartilhados entre o modelo antigo de recorrência reativa
// (agendamentos/[id]/baixas/route.ts) e o novo modelo de série (series/route.ts) —
// extraídos daqui porque agora os dois precisam do mesmo cálculo de "próxima data".

// Mesmo dia do mês seguinte, com o dia ajustado (clamp) se o mês seguinte for mais curto
// (ex: 31/01 -> 28 ou 29/02) — evita datas inválidas tipo 31 de fevereiro.
export function proximoMes(dataStr: string): string {
  const [y, m, d] = dataStr.split("-").map(Number);
  const primeiroDiaProximoMes = new Date(y, m, 1); // mês m (0-indexado) já é o mês seguinte ao mês humano m
  const ultimoDiaProximoMes = new Date(primeiroDiaProximoMes.getFullYear(), primeiroDiaProximoMes.getMonth() + 1, 0).getDate();
  const dia = Math.min(d, ultimoDiaProximoMes);
  const yy = primeiroDiaProximoMes.getFullYear();
  const mm = primeiroDiaProximoMes.getMonth() + 1;
  return `${yy}-${String(mm).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function proximaSemana(dataStr: string): string {
  const [y, m, d] = dataStr.split("-").map(Number);
  const data = new Date(y, m - 1, d + 7);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

export function proximaData(dataStr: string, intervalo: string): string {
  return intervalo === "semanal" ? proximaSemana(dataStr) : proximoMes(dataStr);
}

// Data da parcela N (1-indexado) de uma série, a partir da data da parcela 1 — parcela 1
// retorna a própria dataInicial sem transformação nenhuma.
export function dataDaParcela(dataInicial: string, intervalo: string, numeroParcela: number): string {
  let data = dataInicial;
  for (let i = 1; i < numeroParcela; i++) {
    data = proximaData(data, intervalo);
  }
  return data;
}
