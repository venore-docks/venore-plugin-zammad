# Changelog

Versões anteriores: ver o histórico do git (tags `vX.Y.Z`).

## v1.10.0

### Novidades
- **Fila: aba "Em aberto"**, a primeira e a padrão: todos os chamados abertos, agrupados por etapa (Novo, Em análise,
  Autorizado, Não autorizado, Reavaliação, Atribuído, Em andamento, Concluído), cada etapa com subtítulo na sua cor, o
  total e até 10 linhas, com o atalho "Ver todos os N" para a aba da etapa. Filtro de setor e ordem valem dentro de
  cada etapa.
- **Só Finalizado encerra de verdade.** Não autorizado e Concluído passam a contar como em aberto (listas, carga dos
  agentes, regra do pai). O cabeçalho do chamado mostra o caminho completo com o cadeado no fim ("Etapa N de M · em
  aberto" / "Encerrado"), e o selo de Finalizado ganha cadeado. O caminho após "Não autorizado" agora mostra
  Reavaliação → Autorizado → … até Finalizado.

### Desempenho
- A leitura mais cara (fila e cada agente: 1 + N buscas no Zammad) fica em memória e é compartilhada por Fila, Início do
  gestor, Equipe e carga por agente. Trocar de aba, setor ou ordem na Fila não volta ao Zammad. Fresca por 20 s
  (`COLABORA_QUEUE_CACHE_SECONDS`, 0 desliga); depois entrega o antigo na hora e atualiza em segundo plano; toda
  escrita do plugin no Zammad descarta o cache.

### Atenção
- Um chamado filho "Não autorizado" agora conta como filho em aberto e impede concluir o pai até ser resolvido.

## v1.9.1

### Correções
- **Desempenho**: a pessoa logada era buscada no Zammad 2–3 vezes por página, em sequência e sem cache; agora é
  uma vez por requisição, com cache de 5 min da conta. A Fila só lê solicitante e tags das linhas da aba aberta (a
  v1.9.0 lia de todos os chamados, inclusive os finalizados), não repete a busca da fila sem responsável e só busca
  os encerrados na aba Finalizado (os 50 mais recentes). 25 linhas por vez, com "Mostrar mais".
- **Retorno visual**: abas, filtros, menu e "Mostrar mais" mostram que estão carregando; os botões de ação
  (atribuir, iniciar atendimento, concluir, responder…) ficam ocupados até a tela atualizar, evitando o clique
  repetido.
- `COLABORA_TIMING=1` registra no log do servidor o tempo de cada chamada ao Zammad (diagnóstico).

## v1.9.0

### Novidades
- **Estado Atribuído**, entre Autorizado e Em andamento. Atribuir um responsável a um chamado Autorizado o leva a
  Atribuído; o agente passa a Em andamento com **"Iniciar atendimento"** (de Atribuído ele não conclui direto).
  Devolver à fila um Atribuído volta a Autorizado. A subtarefa (chamado filho) nasce Atribuída. **Exige configurar o
  Zammad** (estado, gatilho de atribuição e avisos — `docs/zammad-fem.md` §1 e §4); sem o estado no Zammad, o
  comportamento antigo continua (atribuir leva a Em andamento).
- **Histórico do chamado** na visão da equipe: abertura e cada mudança de estado, responsável, setor, prioridade e
  tempo previsto, com data, hora e quem mudou. Lido do histórico do Zammad (`GET /ticket_history/:id`).

### Mudanças
- **Fila com todos os estados**: uma aba por estado, na ordem do fluxo — agora também Atribuído, Em andamento,
  Concluído e Finalizado (a aba "Atribuídos", que juntava os estados com agente, saiu; `?etapa=atribuidos` abre Em
  andamento).
- **Repositório renomeado** para `venore-plugin-colabora` (antes `venore-plugin-zammad`); README e CLAUDE.md
  descrevem o Zammad como motor do Colabora. O nome do pacote (`@venore/plugin-colabora`) não muda.

## v1.8.0

### Novidades
- **Chamado filho com os campos do setor de destino.** O diálogo "Criar chamado filho" busca os campos customizados
  do setor que vai receber (lidos do schema e dos Core Workflows do Zammad, papel `ticket.agent`) e os mostra com o
  mesmo componente do wizard. Os campos que o pai já tem (ex.: Local de uso) vêm preenchidos. Resolve o erro do
  Zammad "Missing required value for field 'local_fisico'".
- Nova feature `get-child-form` (server action `getChildFormAction`), com a mesma checagem de permissão da criação.
- A criação remonta o formulário no servidor, valida as respostas e inclui o resumo delas no artigo, mantendo a
  primeira linha "Chamado filho de #N — título".

### Mudanças
- "Pedir a outro setor" lista e aceita só setores folha; setor com subgrupos é recusado com "Escolha o assunto em
  <setor> para continuar.".
- `FieldInput` saiu do wizard para `routes/public/field-input.tsx` (usado pelo wizard e pelo chamado filho).
