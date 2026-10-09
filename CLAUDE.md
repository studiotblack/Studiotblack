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
de novo" depois (testado: `fetchMessageHistory` sob demanda não respondeu).
Se a função for morta pelo timeout da Vercel (60s) antes de guardar a
mensagem, ela some pra sempre. Em 08/10/2026, ao reparear, o WhatsApp
despejou 377 mensagens de histórico de uma vez, o tempo acabou antes de baixar
as fotos e ~21 comprovantes ficaram só com a legenda (fotos irrecuperáveis).
Arquitetura atual, **"persistir primeiro, baixar depois"** (`sincronizar/route.ts`
+ `src/lib/whatsapp/coletar-mensagens.ts`):
1. O coletor dispara o download de cada foto NO INSTANTE em que a mensagem
   chega (paralelo, via CDN — continua depois do socket fechar).
2. A rota grava as mensagens novas EM LOTE (40 por INSERT) já com
   `mensagemRaw` (proto da mensagem via `BufferJSON.replacer`), antes de
   qualquer download/OCR. `idsConhecidos` evita rebaixar o que já existe.
3. Fila de recuperação (2b-bis): comprovantes sem `imagemBuffer` e com
   `mensagemRaw` são baixados em lotes de 5, até 20 por execução,
   `tentativasMidia < 5`. Se sobrar, o próximo "Sincronizar" continua.
4. OCR (OCR.space, `reconhecerTextoOcrSpace`) lê o valor; ao resolver, limpa
   `imagemBuffer` e `mensagemRaw`.
O valor só existe na foto (legenda raramente traz) — por isso baixar é
obrigatório. Ideal futuro: processo sempre ligado (VPS/PC da loja) segurando a
conexão, sem depender do clique. Nunca usar `fetchMessageHistory`/reparear só
pra "testar": reparear dispara histórico grande.

**Sessão do WhatsApp caiu (401 / logged out)?** Reparear com
`npx tsx scripts/whatsapp-pair.ts <DDI+número>` (gera CÓDIGO de 8 caracteres
em vez de QR, que expira em ~20s). Passos que funcionaram: (1) apagar
`WhatsappAuthState` (sessão morta, sem perda); (2) rodar o script; (3) no
celular: Aparelhos conectados → Conectar um aparelho → **Conectar com número
de telefone**; digitar o código logo. O aparelho virtual precisa se identificar
como `Browsers.ubuntu("Chrome")` no pareamento por código (com "Desktop" dá
"Erro ao conectar"). O código só vale enquanto a conexão de pareamento está
aberta (poucos minutos); ao expirar, limpar `WhatsappAuthState` e rodar de
novo (reconectar com credenciais parciais só dá 401). Número do aparelho:
5512981005830. Grupo alvo: "Gastos Studio T'Black"
(`5512996375825-1592779053@g.us`).

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

**Regra aprendida nunca pode ter o CNPJ do próprio studio nem rótulo de
transferência.** Em 01/09/2026 uma regra com padrão `27.972.578 0001-66` (CNPJ
do Studio T'Black, que aparece como PAGADOR no texto de TODA transferência Pix
Sicoob) mandou todas as transferências para "Porto Seguro Consórcios"
(R$ 6k lançados errado, corrigido). Agora `regra-conciliacao.ts` bloqueia esse
CNPJ (em qualquer formatação) e `"transf.realizada pix sicoob"`.

**Conta recorrente quitada por QUALQUER caminho gera a próxima ocorrência.**
Antes só a baixa manual (`agendamentos/[id]/baixas`) criava o próximo
lembrete; pela Conciliação Bancária ou pelo sync do Sicoob a conta quitava e o
lembrete do mês seguinte sumia (aconteceu com comissões). Agora a lógica está
em `src/lib/financeiro-quitacao.ts` (`gerarProximaOcorrencia`, com guarda
contra duplicar) e é chamada pelos 3 caminhos. Qualquer novo código que
atualize `valorPago` deve chamá-la dentro da transação.

**Sicoob: `sincronizar-sicoob` sem mês explícito (cron) puxa também o mês
anterior nos primeiros 7 dias do mês** — antes olhava só o mês corrente e 29 e
30/09 nunca foram importados.

## DRE e receita — regras de negócio confirmadas (Out/2026)

O DRE (`/api/financeiro/dre-sistema`) soma por `dataCompetencia`, usando as
categorias do lançamento (`LancamentoFinanceiroCategoria`). **Lançamento sem
categoria, ou com categoria sem código (`codigo IS NULL`), NÃO aparece no DRE**
— sempre conferir isso no fechamento. Itens de folha/comissão entram pela DATA
DO PAGAMENTO (comissão de agosto paga em setembro cai em setembro; salário
da recepção chegou a ter 2 meses em setembro) — explicar isso ao comparar meses.
- **Receita = Sicoob + AppBarber fora do banco** (`src/lib/receita-appbarber.ts`):
  - Serviço recebido no Sicoob → "Venda de Serviços" (regra automática de entrada).
  - **PRODUTO nunca passa pelo Sicoob** (liquidado em outra conta; confirmado
    pelo dono). Soma como "Vendas Produtos" (1.1.1.01.002) a partir do
    AppBarber, qualquer forma de pagamento. NÃO "mover" de dentro de Serviços
    (era o desenho antigo, subestimava a receita).
  - **DINHEIRO de serviço nunca passa pelo banco**: soma em "Venda de
    Serviços" a partir do AppBarber (`pagamento = 'Dinheiro'`). Validado: a
    comissão por forma de pagamento bate com o resumo do app (R$ 0,00 de
    diferença em crédito/PIX/dinheiro). Se depositarem dinheiro no Sicoob,
    categorizar como transferência, NUNCA Venda de Serviços (dupla contagem).
  - Linhas do AppBarber de antes de setembro têm `pagamento` NULO (parser só
    passou a ler a coluna em set/2026) → dinheiro de jan-ago não é conhecido,
    até reimportar. Arquivo com jul/ago/set já exportado (`Downloads\AppBarber
    Comissões.xlsx`, ainda NÃO importado): dinheiro jul R$ 1.909,97
    (serviço 1.480), ago R$ 3.008,50 (serviço 2.462,50), set R$ 1.880,00.
    **Nunca importar esse arquivo para setembro**: ele termina em 29/09 e o
    importador apaga o mês inteiro (perderia o dia 30).
- `isProduto()` (`performance-data.ts`) trata como produto tudo que não está em
  `catalogoServicos` e não tem "corte" no nome. **Serviço novo/combo no AppBarber
  tem que entrar em `catalogoServicos`**, senão vira "produto" e a venda é
  contada em dobro (aconteceu com "Sobrancelha + Manutenção" e
  "Avaliaçõa/Coloração retoque de raiz", ambos já cadastrados). Tira-teima: a
  comissão de serviço tem que bater com o "Serviço bruto" do resumo do app
  (set/2026: R$ 21.408,97 — bate).
- **Retirada do dono (Tiago) = categoria Prolabore (1.1.2.03.030, operacional),
  não Distribuição de Lucros.** Vale também para comprovantes com legenda "pro
  labore" (compras pessoais pagas pela empresa). Tiago NÃO tem comissão
  (é o dono). A regra aprendida "transferência pix" aponta para Prolabore.
- "Gestão do Studio" (R$ 1.500/mês) → categoria Consultoria/Assessoria
  (1.1.2.02.030). A categoria antiga "Gestão do Studio" não tem código e some
  do DRE — não usar.
- Aportes ("Entrada de Recursos a Alocar", ex: R$ 20.500 do Tiago em 16/09
  "para investir") e RDC (aplicação) são financiamento/investimento, não venda.
  Pedido do dono: tratar o RDC à parte nas análises.
- Há dezenas de regras aprendidas que mandam compras variadas (farmácia, posto,
  lanchonete) para Distribuição de Lucros — é a convenção do dono (despesa
  pessoal paga pela empresa, herdada do Nibo). NÃO mexer sem pedir.
- Banco × AppBarber (serviço sem dinheiro): cartão do banco fica ~5-6%
  abaixo do AppBarber (taxas + antecipação, DRE mostra receita LÍQUIDA de taxa
  de cartão, sem linha de despesa); PIX bate quase 1:1; cartão de fim de mês
  entra no mês seguinte. Comparar em janelas de 2 meses.

## Comissões e lembretes do Contas a Pagar

- Pagamento das comissões: 5º dia útil do mês seguinte. O valor FINAL é o da
  tela Performance. O Contas a Pagar tem um lembrete mensal por profissional
  ("Comissão — X (valor final = Performance)", categoria Comissões, contato
  oficial de `PROFISSIONAL_CONTATO_MAP`): Gi, Vanessa, Henrique, Bruna, Wallace,
  Otávio (Tiago NÃO). Ao pagar, baixar o LEMBRETE (ajustando o valor) — não criar
  lançamento novo. Também: Bia (Beatriz Marques de Mello) R$ 560 no 5º dia útil
  + R$ 560 no dia 20, mensais.
- Recepção: salários R$ 800 + VT R$ 340 cada (Ana Clara e Clara), lembretes
  mensais dia 30. O VT de setembro estava em duplicidade (baixa manual sem
  dinheiro saindo) e foi removido.
- Wallace e Wallacy são a MESMA pessoa (`normalizeProfName` → "Wallacy").
- Quando o limite de Pix da conta do studio estoura, o dono paga via conta da
  Maria Justa (ex.: R$ 3.982 em 06/10 = salários 800+800 da recepção, já
  lançados nas contas delas, + R$ 2.382 comissão do Wallace). Lançar assim.
- Divergências a conferir sempre: comissão paga × valor da Performance
  (set/2026: Wallace pago 2.382 × 2.529,20; Vanessa 5.118,88 × 5.211,91;
  Otávio 1.777,68 × 1.771,68).

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
- Gráficos com um item por profissional (são ~11) usam **barras horizontais**
  com o nome sempre visível e rótulo no fim da barra (`brlCompacto`, "R$ 142,8
  mil"); barras verticais com rótulos em cima se sobrepunham. Profissional sem
  dado (RECEPÇÃO sem ocupação, valor zero) fica fora do gráfico.

## Fluxo de trabalho

- Scripts temporários de investigação/dados vão em `scripts/_tmp-*.ts`
  (rodar com `npx tsx`) e devem ser apagados depois de usar — nunca ficam no
  repo.
- `git push` trava intermitentemente no Windows (parece ser o Git Credential
  Manager) — se travar, tentar de novo com timeout maior; às vezes precisa
  checar se abriu um popup de autenticação escondido.
- Sempre subir (`git push`) logo depois de cada commit, sem precisar
  perguntar.
- Commits terminam com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- **Correções de dados em produção** (apagar regra, reclassificar lançamentos,
  refazer baixa) só depois do "pode aplicar" do dono — o sistema de permissões
  já bloqueou um lote sem aprovação explícita. Fazer em transação, com
  pré-condições no WHERE (descrição/valor) para ser idempotente, e conferir
  depois pelas mesmas consultas da tela (o DRE pode ser calculado chamando
  `GET` de `dre-sistema/route.ts` num script `tsx`; as rotas de sincronização
  também rodam local com `NextRequest`/`getDb`, carregando o `.env` à mão).
- Auditoria de fechamento (rodar antes de fechar o mês): lançamentos sem
  categoria ou com categoria sem código; transações bancárias `pendente`/
  `ignorado`; `valorPago` × soma das `Baixa`; transação conciliada sem
  lançamento; comprovantes `vinculado` sem transação; comissão paga × Performance.

## Ambiente (máquina atual: Windows, usuário `USER`)

- Projeto em `C:\Users\USER\.gemini\antigravity\scratch\Black` (a máquina
  antiga era `C:\Users\Administrador\...`; o `scripts/scheduled-import.ps1` e o
  `Atualizar Performance.bat` antigos ainda apontam pra lá e não funcionam).
- No shell do Claude `node`/`npx`/`git` podem não estar no PATH. PowerShell:
  `$env:PATH = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`.
  Bash: `export PATH="$PATH:/c/Program Files/nodejs"`. Usar `node_modules/.bin/tsx`.
- Git: identidade configurada (João Henrique); push pelo GitHub exige a conta
  **tblack** (popup do Credential Manager só abre no terminal do próprio usuário,
  não no shell do Claude). Repo: github.com/studiotblack/Studiotblack.
- Importador do AppBarber: `scripts/importar-appbarber.bat` (cópia na Área de
  Trabalho — existem DUAS áreas: `Desktop` e `OneDrive\Área de Trabalho`).
  Comissões soltas em `Downloads\AppBarber\`; ocupação em
  `Downloads\AppBarber\Taxa de Ocupação\<Nome>\` (ou `Ocupacao`). O importador
  valida colunas e recusa planilha com valores zerados (mantém o arquivo);
  filtro ignora linhas de rodapé (resumo "Serviço Bruto/Saldo/Formas de
  pagamento"). Importar substitui o mês inteiro por profissional.
- Importação por `id` = profissional-item-data-cliente: linhas idênticas se
  fundem (11 em set/2026 → R$ 1,50 de comissão). Conhecido, de baixo impacto.

## Segurança

- Alerta do Supabase (03/10/2026): 7 tabelas sem RLS (`WhatsappAuthState`,
  `MetaFinanceira`, `RegraConciliacaoBancaria`, `CompraCartaoCredito`,
  `LancamentoSerie`, `MetaProfissional`, `SyncDiagnostico`). O sistema NÃO usa a
  API pública (conexão direta com o usuário `postgres`, que ignora RLS), então
  ligar RLS + `REVOKE ALL ... FROM anon, authenticated` (inclusive
  `ALTER DEFAULT PRIVILEGES`, pois o sistema cria tabelas sozinho) não afeta o
  app. O dono roda o SQL no SQL Editor do Supabase; conferir depois com a
  consulta de `pg_class.relrowsecurity` e `has_table_privilege('anon', ...)`.
  Dado sensível guardado no banco: sessão do WhatsApp, chave privada e
  certificado do Sicoob (`ContaBancaria`), hash de senha (`User`).

## Estado e pendências (08/10/2026)

- DRE de setembro/2026: receita R$ 61.704 (serviços 55.689 + produtos 6.065),
  resultado operacional R$ 2.039. Julho está INCOMPLETO no sistema (comissões
  R$ 7 mil e pró-labore R$ 529 destoam do padrão; faltam 10 linhas do AppBarber,
  R$ 1.145) — não usar como referência até completar.
- Agosto de receita pode estar inflado em até R$ 3,4 mil por 3 entradas
  classificadas como venda (Adriana Francisca R$ 1.500 e R$ 830; R$ 1.078 do
  próprio CNPJ do studio) — aguardando o dono dizer o que são.
- Aguardando o dono: autorização para importar jul/ago do arquivo de comissões;
  origem dos R$ 468,35 de 30/09 (crédito); lista de compras da fatura do cartão
  de setembro (compras acumuladas: set R$ 1.007,14, out/nov R$ 702,69; o débito
  de R$ 661,58 de 22/09 já está como Cartão de Crédito); R$ 1.385,94 de
  06/01/2026 (boleto sem destinatário, pendente); R$ 250 (08/09) e R$ 2,50
  (25/09) pendentes; 14 comprovantes de 02-06/10 só com legenda (reenviar
  fotos); PIX R$ 468,75 já como consórcio.
- Dados de 2025 (≈260 saídas bancárias pendentes, R$ 94,5 mil) são IGNORADOS por
  decisão do dono: o foco é 2026.
- Pós-mortem de antes de 06/10 está em `CONTEXTO-ANTERIOR.md` (arquivo do dono,
  fora do git) e nas memórias do Claude.
