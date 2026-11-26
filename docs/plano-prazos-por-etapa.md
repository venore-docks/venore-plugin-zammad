# Prazos por etapa — plano

Status: **aprovado em 26/11/2026** (todas as decisões, inclusive as duas propostas abaixo). Os issues estão prontos
para criar no GitHub (épico + 7).

## O pedido

- Todo chamado **Novo** precisa ser **analisado** em **2 h úteis** (atendimento das 8h às 18h). Estourou: alerta ao
  gestor.
- **Atribuído**: também **2 h úteis** até o agente iniciar o atendimento. Estourou: alerta ao gestor **e ao agente**.
- **Em andamento**: o prazo é o **tempo previsto** que o gestor definiu no chamado, em **horas úteis**, e **pausa**
  enquanto o chamado espera o solicitante.
- Todos os tempos **customizáveis**. Alerta **também por e-mail** (enviado pelo Zammad).
- Feriados vêm do **plugin Calendários** (não do Zammad).

## Por que no Colabora e não no Zammad

O SLA do Zammad conta sempre a partir da **abertura** do chamado (1ª resposta, atualização, solução), não desde a
entrada num estado; não usa o tempo previsto de cada chamado; e o alerta de escalonamento só aparece na tela do
Zammad, que ninguém usa. Os gatilhos e o agendador do Zammad contam tempo corrido, não horário útil. O Zammad entra
como fonte (histórico de estados) e como carteiro (o e-mail do alerta).

## Decisões

| Pergunta | Decisão |
|---|---|
| O que é "analisado" (para o prazo de Novo) | O gestor **clicar em Analisar**. Só sair de Novo não basta (ver abaixo) |
| Tempo previsto conta em horário útil | Sim. Opções em horas = horas úteis; em dias/semanas = dias úteis (1 semana = 5 dias úteis de 10 h) |
| Em andamento pausa esperando o solicitante | Sim (ver abaixo) |
| Agente recebe o alerta de Atribuído | Sim (e o de Em andamento, que também é dele) |
| E-mail | Sim, pelo Zammad: o Colabora marca o chamado e um gatilho do Zammad envia (prompt de configuração em `docs/zammad-prompt-alerta-prazos.md`) |
| Feriados | Do **plugin Calendários**, não do Zammad |

### Como registrar o "Analisar" (aprovado)

Abrir uma tela não fica registrado em lugar nenhum. Proposta: ao clicar em **Analisar** (fila) num chamado Novo, o
Colabora põe a tag **`analisado`** no chamado. O Zammad guarda no histórico quem pôs a tag e quando, e esse momento
para o relógio de Novo. Na tela do chamado, que não tem o botão Analisar, vale o mesmo ao clicar em **Iniciar
análise**, **Autorizar** ou **Não autorizar**, porque são decisões tomadas depois de ler o pedido.

### Como saber que o chamado "espera o solicitante" (aprovado)

Proposta: um botão explícito na resposta do agente, **"Aguardar resposta do solicitante"**. Ele envia a mensagem e
põe a tag `aguardando-solicitante`; a resposta do solicitante pelo portal tira a tag. O relógio fica parado entre as
duas. Deduzir isso de "quem escreveu por último" pararia o relógio a cada atualização de andamento que o agente
manda, então não foi a escolha.

## Como vai funcionar

1. **Quando o chamado entrou em cada etapa, e as pausas**: vêm do histórico do Zammad (`GET /ticket_history/:id`,
   já usado desde a v1.9.0), incluindo as tags `analisado` e `aguardando-solicitante`. Nada é gravado à parte, e o
   que é feito na tela do Zammad ou por gatilho também conta. Fica em cache por chamado + `updated_at`, porque o
   histórico só muda quando o chamado muda.
2. **Calendário de atendimento**: dias úteis, das 8h às 18h (configurável), fuso America/Sao_Paulo. Os **feriados**
   vêm do plugin Calendários (ver abaixo). O módulo é puro e calcula "quanto tempo útil passou" e "quando vence".
3. **Prazos** (customizáveis no admin do Colabora, aba "Prazos"):

   | Etapa | Começa | Para | Pausa | Padrão |
   |---|---|---|---|---|
   | Novo | abertura | gestor clica em Analisar (tag `analisado`) | — | 2 h úteis |
   | Atribuído | entra em Atribuído | agente inicia (Em andamento) | — | 2 h úteis |
   | Em andamento | entra em Em andamento | Concluído | com a tag `aguardando-solicitante` | tempo previsto |

4. **Situação**: no prazo · atenção (passou de 75% do prazo, configurável) · atrasado.
5. **Onde aparece**: selo "vence 15:30" ou "atrasado 40 min" nas linhas da Fila, de Atribuídos a mim, do Início do
   gestor e na tela do chamado; filtro "Atrasados" na Fila; contador de atrasados no Início do gestor.
6. **Alerta**: uma tarefa agendada do plugin (`scheduledJobs`; o cron do core bate a cada 5 min) só roda no
   horário de atendimento. Ela procura os chamados que entraram em atenção ou atraso e:
   - manda **push no app** ao gestor do setor (e ao responsável, em Atribuído e Em andamento) — `sendPushToActor`;
   - no **atraso**, grava no chamado uma **nota interna** com o assunto `[PRAZO_ATRASADO] <Etapa>` e a tag
     `prazo-<etapa>` (`prazo-novo`, `prazo-atribuido`, `prazo-andamento`). O gatilho do Zammad vê a nota e manda o
     **e-mail**. A tag evita alerta repetido e sai quando o chamado muda de etapa.

   A tarefa lê os chamados **em nome de um gestor de cada setor** (`X-On-Behalf-Of`), como as telas já fazem, então
   não precisa de um usuário técnico novo no Zammad.

### Feriados pelo plugin Calendários

O Calendários já tem um **calendário-base geral** com feriados e recessos da instituição (e calcula os feriados
nacionais ao iniciar o ano). Dois cuidados:

- **Recesso escolar não é folga da equipe de atendimento.** O Colabora usa só as categorias escolhidas no admin
  (padrão: as de nome "Feriado"), não tudo que "não é dia letivo".
- O Calendários **não exporta** hoje uma leitura das datas. É preciso uma função pública nova nele (ex.:
  `listMarkedDays({ calendárioId, de, até, categorias })`), e o Colabora a usa só se o plugin estiver ativo. Sem o
  Calendários, valem só os fins de semana. Isso dá uma versão do Calendários junto com a do Colabora.

## Issues

### Épico: Prazos por etapa (Novo, Atribuído, Em andamento) com alerta ao gestor

Critério de aceite: um chamado Novo sem "Analisar" por 2 h úteis aparece atrasado na Fila, o gestor do setor recebe
push e e-mail; o mesmo para Atribuído (gestor e agente); Em andamento usa o tempo previsto em horas úteis e para de
contar enquanto espera o solicitante; feriados do Calendários não contam; os prazos mudam pelo admin sem deploy.

### 1. Calendário de atendimento (horário útil)

Módulo puro `shared/business-hours.ts`: `elapsedBusinessMs(início, fim, calendário, pausas)` e
`deadlineAfter(início, duraçãoÚtil, calendário, pausas)`. America/Sao_Paulo (UTC-3 fixo), dias úteis, janela
configurável (padrão 8h–18h), feriados recebidos de fora. Testes: virada de dia, fim de semana, feriado, início fora
do horário, pausa atravessando a noite.

### 2. Feriados vindos do plugin Calendários

No Calendários: função pública de leitura das datas marcadas de um calendário por período e categorias (com teste).
No Colabora: escolher no admin o calendário (padrão: o base geral) e as categorias que são folga (padrão:
"Feriado"); ler com cache diário; sem o plugin ativo, só fins de semana.

### 3. Entradas, marcos e pausas a partir do histórico do Zammad

`stageTimeline(history)` (puro): quando o chamado entrou em cada etapa (vale a última entrada), quando recebeu a tag
`analisado` e os intervalos com `aguardando-solicitante`. Carregador no servidor com cache por chamado +
`updated_at`, em lote para as listas (limite de buscas em paralelo). Reaproveita `shared/ticket-history.ts`, que
passa a ler também tags adicionadas e removidas.

### 4. Registrar "Analisar" e "Aguardar resposta do solicitante"

Analisar (fila) e as decisões do gestor na tela do chamado põem a tag `analisado` num chamado Novo. Na resposta do
agente, a opção "Aguardar resposta do solicitante" põe `aguardando-solicitante`; a resposta do solicitante pelo
portal tira. Validação no servidor (só o responsável ou o gestor).

### 5. Configuração e situação do prazo

Setting `colabora.prazos` + aba "Prazos" no admin: janela de atendimento, prazo por etapa (horas úteis ou "tempo
previsto"), limite de atenção (%), calendário e categorias de feriado, quem é avisado. `deadlineStatus(...)` (puro):
`{ etapa, venceEm, situação: no_prazo | atencao | atrasado, atraso, pausado }`. O tempo previsto vira duração útil
(horas = horas úteis; dias/semanas = dias úteis). Sem tempo previsto: sem prazo, com o aviso "defina o tempo
previsto".

### 6. Exibição e alertas

Selos de prazo (Fila, Atribuídos a mim, Início do gestor, tela do chamado), filtro "Atrasados" e contador. Tarefa
agendada (`contributions.scheduledJobs`, a cada 5 min, só no horário de atendimento): push ao gestor (e ao
responsável), nota interna `[PRAZO_ATRASADO] <Etapa>` + tag `prazo-<etapa>` no atraso, sem repetir. Pessoa do
Zammad → conta do portal pelo e-mail.

### 7. Documentação e verificação contra o Zammad real

`docs/zammad-fem.md` (gatilho do e-mail, tags), README, CHANGELOG. Teste guiado: um chamado de teste parado em Novo
além do prazo, conferindo selo, push e e-mail; um Em andamento com pausa.

## Ordem

1 → 2 → 3 → 4 → 5 → 6 → 7. Do 5 em diante o gestor já vê os atrasos; o 6 traz os alertas. O 1, o 3 e o cálculo do 5
são puros e testáveis sem o Zammad. O 2 mexe também no plugin Calendários; o 6 depende do `CRON_SECRET` na instância
(o cron do core).

## Riscos

- **Volume de buscas**: uma busca de histórico por chamado aberto; com cache por `updated_at` e paralelismo
  limitado, só os que mudaram são buscados de novo.
- **Tag como registro**: se alguém tirar a tag `analisado` na tela do Zammad, o relógio de Novo volta a correr. É
  aceitável (fica no histórico), mas vale saber.
- **E-mail depende do gatilho do Zammad**: sem ele, o alerta fica só no push e no selo.
