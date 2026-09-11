@AGENTS.md

# Black Gestão — Studio T'Black

Sistema de gestão (financeiro, agenda, performance) do Studio T'Black, uma
barbearia/salão. Next.js 16 (Turbopack) + Postgres (Supabase, pooler
`aws-0-us-east-2.pooler.supabase.com:6543`). O módulo financeiro usa SQL puro
via `postgres` (npm), NÃO Prisma Client em runtime — schema gerenciado à mão em
`src/lib/financeiro-db.ts`.

## Regras que já doeram pra descobrir — não repetir

**`ensureFinanceiroTables` (financeiro-db.ts) tem que rodar sequencial, NUNCA
em transação.** Já tentei empilhar as ~37 instruções de DDL num único
`sql.begin()` + `Promise.all()` pra ganhar velocidade — deu deadlock real
(Postgres `40P01`) toda vez que duas requisições concorrentes batiam na
função ao mesmo tempo (comum: a tela dispara vários fetches em paralelo ao
abrir, e cada um chama essa função). Uma transação segurando
`AccessExclusiveLock` em ~15 tabelas por vários segundos é receita pra
deadlock. Sequencial (`await sql\`...\`;` um de cada vez, sem transação)
mantém cada lock preso só por milissegundos — mais lento (~1-2s) mas seguro
sob concorrência. Não vale o risco de derrubar a tela inteira com 500.

**Toda lógica de "achar o registro correspondente" (matching/reconciliação)
tem que limitar por valor E por data — nunca só valor.** Já vazou um bug real
onde uma conta de setembro/2026 casava com uma transação bancária de
novembro/2025 só por coincidência de valor. Isso é ainda mais perigoso em
código que age sozinho (dá baixa automática sem confirmação) do que em
sugestões pra confirmação manual — o sistema tem várias contas recorrentes
com valor idêntico todo mês (aluguel, salários, comissões), então "só valor"
tem chance real de casar com o mês errado. Convenção atual: tolerância de
valor pequena (poucos centavos a poucos reais, dependendo do contexto) +
tolerância de data (15 dias pra ações automáticas, 45 dias pra sugestões com
confirmação manual — o "Match" do Contas a Pagar e o `agendamentosCompativeis`
da Conciliação Bancária).

**Mesma regra vale pra "regra aprendida" (`RegraConciliacaoBancaria`) — nunca
casar por rótulo genérico do banco.** Descrições como "déb.tit.compe
efetivado", "pix emitido outra if" são rótulos de TIPO de transação que o
próprio Sicoob usa pra qualquer liquidação/pix, não identificam nenhuma
contraparte específica. Uma regra aprendida uma vez em cima de um rótulo
desses recategoriza (e concilia sozinho, sem confirmação) toda transação
futura do mesmo tipo — já aconteceu de verdade (uma compra de lixeira
elétrica "roubou" a transação de uma lavagem de toalhas completamente sem
relação). Denylist desses rótulos em `src/lib/regra-conciliacao.ts`,
aplicado tanto na hora de aprender a regra (POST /regras-conciliacao) quanto
em toda leitura (sync automático do Sicoob, "aplicar regras" manual,
vínculo do WhatsApp).

**WhatsApp (Baileys) só entrega cada mensagem UMA vez** — não tem como "pedir
de novo" depois. Se a função for morta pelo timeout da Vercel (60s) antes de
salvar uma mensagem no banco, ela some pra sempre. Por isso
`sincronizar/route.ts` separa em duas fases: salva TODAS as mensagens
primeiro (rápido, só regex na legenda), roda OCR depois com limite por
execução (`MAX_OCR_POR_EXECUCAO`) — na pior das hipóteses um comprovante fica
esperando o valor ser preenchido à mão, mas nunca desaparece.

**Debugar produção sem acesso fácil ao dashboard da Vercel:** existe uma
tabela `SyncDiagnostico` (via `src/lib/diagnostico.ts`) que grava checkpoints
de tempo direto no Postgres durante a sincronização — sobrevive mesmo se o
processo for morto no meio da execução, ao contrário de `console.log`
bufferizado que pode não chegar a tempo no agregador de logs.

**`tesseract.js` sem `langPath` explícito baixa o modelo de idioma (~8MB) de
um CDN externo (jsdelivr) TODA VEZ que cria o worker** — nenhuma função
serverless (sem disco persistente) se beneficia do cache do pacote. Era a
causa real de vários "504" na sincronização do WhatsApp: o download sozinho
consumia 30-40s do orçamento de 60s da função, sem nenhuma relação com o
tamanho da imagem ou a qualidade do OCR. Confirmado batendo a tabela
`SyncDiagnostico` (o log parava sempre logo depois de "gravar os novos",
nunca chegava em "depois do OCR") contra o pacote `@tesseract.js-data/por`
instalado localmente — `createWorker` caiu de 30-40s pra ~500ms apontando
`langPath` pro pacote local. Como esse caminho só existe como string (nunca
é `require`/`import`), precisa do `outputFileTracingIncludes` em
`next.config.ts` também — senão o rastreamento de arquivos da Vercel não
inclui o pacote no deploy e o `langPath` aponta pro vazio em produção.

## Convenções de UI já estabelecidas

- **Nunca usar `confirm()`/`alert()` nativos do navegador** — fora do padrão
  visual do resto do sistema. Usar o modal temático (`.modal-overlay` /
  `.modal-box`, ver `BaixaModal.tsx` como referência).
- Cards de KPI usam a classe `.kpi-card`; cards genéricos, `.card`.
- Cuidado com `overflow: hidden` em cards que contêm dropdowns/comboboxes
  absolutamente posicionados (`CategoriaCombobox`) — já cortou um dropdown
  inteiro porque o card usava `overflow: hidden` só pra encaixar o cantinho
  de um selo decorativo. Preferir dar `border-radius` direto no elemento
  decorativo em vez de clipar o card inteiro.
- Padrão de tela com muitos itens: agrupar por urgência/bucket (ver
  `bucketAgendamento` em `financeiro-data.ts` e `AgendamentosTable.tsx`) em
  vez de tabela plana; ações em lote via checkbox + barra flutuante,
  reaproveitando os endpoints de item único em vez de criar endpoints de lote
  novos.
- A ordem das abas do módulo Financeiro é controlada pelo array `tabs` em
  `src/app/(sistema)/financeiro/page.tsx`.

## Fluxo de trabalho

- Scripts temporários de investigação/dados vão em `scripts/_tmp-*.ts`
  (rodar com `npx tsx`) e devem ser apagados depois de usar — nunca ficam no
  repo.
- `git push` trava intermitentemente no Windows (parece ser o Git Credential
  Manager) — se travar, tentar de novo com timeout maior; às vezes precisa
  checar se abriu um popup de autenticação escondido.
- Sempre subir (`git push`) logo depois de cada commit, sem precisar
  perguntar.
