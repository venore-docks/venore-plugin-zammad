# Changelog

Versões anteriores: ver o histórico do git (tags `vX.Y.Z`).

## v1.13.0

### Novidades
- **Banco próprio do Colabora** (schema Postgres `colabora`, migration `0000_colabora_inicial`):
  - `ticket_events`: cada mudança de um chamado vinda do Zammad (histórico ou webhook), com chave natural única
    (`event_id`): evento repetido não duplica; fora de ordem não importa (os intervalos são recalculados pela data);
  - `ticket_intervals`: tempo em cada estado (chamado, estado, setor, agente, início, fim, motivo da pausa, nota do
    plugin, segundos corridos e úteis), trocados por inteiro numa transação a cada recálculo;
  - `plugin_notes`: anotações só do plugin.
- **"Interrompido por #N"**: o chamado pausado automaticamente (um Em andamento por agente) ganha essa anotação do
  plugin, que a equipe vê no chamado. Falha no banco não desfaz o atendimento.
- `scripts/run-tests.ps1 -Integration`: testes do banco contra Postgres em memória (PGlite). `scripts/db-generate.ps1`
  gera migrations com o drizzle-kit do core.

### Atenção
- **No próximo deploy o core cria o schema `colabora`** no banco do portal (o `prebuild` aplica as migrations dos
  plugins instalados; migration com erro falha o build).
- Os eventos e intervalos ainda não são preenchidos: a ingestão (webhook e conferência pelo histórico) é a próxima
  versão.
- Correção nos scripts: `run-tests.ps1` sobrescrevia a variável automática `$args` do PowerShell (o vitest não rodava)
  e passa a usar o mesmo mutex do `verify.ps1`; scripts `.ps1` só em ASCII (o PowerShell 5.1 lê arquivo sem BOM como
  ANSI).

## v1.12.0

### Novidades
- **Em pausa**: botões **Pausar** (em Em andamento) e **Retomar** (em Em pausa), para o responsável e para o gestor do
  setor. Pausar pede o motivo (opções do campo `motivo_pausa` do Zammad) e vai num único envio com o estado. Em pausa só
  volta para Em andamento. Aparece na Fila (aba e contador próprios, entre Em andamento e Concluído), no selo e na barra
  de etapas ("Etapa 5 de 7 · em pausa"); a equipe vê o motivo no chamado.
- **Um chamado Em andamento por agente**: ao iniciar ou retomar um chamado, os outros Em andamento do mesmo
  responsável são pausados (motivo "Urgência / outro chamado") antes, e o aviso diz quais. Se o chamado novo não
  puder iniciar, os pausados voltam. Retomar é sempre explícito.
- **O que a mudança exige vem do Zammad**: antes de mudar o estado, o plugin avalia os Core Workflows da tela de
  edição (na FEM, a regra 810 exige tempo previsto e prazo ao entrar em Atribuído ou Em andamento; a 800, o motivo ao
  pausar) e coleta ou preenche no mesmo envio — o Zammad não devolve mais 422. Sem tempo previsto ou prazo definidos
  pelo administrador do setor, o plugin preenche **1 dia útil** (tempo previsto "1 dia"; prazo = agora + 1 dia útil
  pelo calendário do Zammad) e avisa. Outro campo exigido que o plugin não sabe preencher vira uma mensagem clara.
- **Prazo de entrega** (`prazo_entrega`): todos veem no chamado; o administrador do setor edita ao lado do tempo
  previsto. Fila e Início do gestor mostram prazo e tempo previsto em cada linha.
- **Horas úteis pelo calendário do Zammad** (`shared/business-hours.ts`, puro): dias, faixas, feriados e fuso do
  calendário padrão ("Horário comercial FEM", seg–sex 9h–17h). Base dos relógios das próximas versões.

### Mudanças
- O **tempo previsto** passa a ser visto só pela equipe (como no Zammad, onde o campo é oculto para o cliente).
- Mudar o estado à mão para Em pausa sai do seletor manual: só pelo botão Pausar, que pede o motivo.

### Atenção
- A anotação "interrompido por #N" no chamado pausado automaticamente fica para a versão com o banco do plugin; por
  ora o aviso aparece só na tela de quem iniciou.
- O token do Zammad precisa de `admin.calendar` para ler o calendário; sem ele, vale seg–sex 9h–17h (o log avisa).
- Escritas do agente/gestor (pausar, retomar, padrões) testadas só contra o recorte do Zammad, não contra o Zammad real.

## v1.11.0

### Correções
- **Campos condicionais por valor (Core Workflows).** O formulário era montado uma vez só, com o setor, e regras como
  "Sistema afetado = Portal do Colaborador → pergunta Ferramenta do portal" ou "= Broadcast e TVs → Telas afetadas"
  nunca casavam: o assistente não perguntava, o servidor também não, e o Zammad recusava (422). Agora o assistente
  reavalia as regras a cada resposta e o campo liberado aparece **na mesma etapa, logo abaixo** da pergunta que o
  liberou. Resposta de campo que volta a ficar oculto (ou opção que deixa de valer) é descartada. O servidor refaz a
  mesma avaliação com as respostas finais antes de criar o chamado. Vale também para o **chamado filho**, que herda do
  pai o valor que libera o campo e o próprio campo condicional.

### Novidades
- **Avaliador dos Core Workflows completo**: condições do ticket em edição e do ticket salvo (`condition_saved`), pela
  função (`session.role_ids`), com os operadores is / is not (e `is_not`, is any of, is none of), is set / not set,
  contains (all, one, not), starts/ends with e regex; ações show, hide, set_mandatory, set_optional, set_readonly,
  unset_readonly, set_fixed_to, add_option e remove_option, por prioridade (o número maior roda depois e vence).
- **Admin → Setores**: a lista de perguntas mostra também os campos condicionais ("condicional"), para receberem
  texto de ajuda e número de etapa.
- **Prioridade sugerida** (`prioridade_cliente`): o assistente pergunta quando o Zammad a torna obrigatória para quem
  abre; opcional, continua de fora.
- `scripts/export-zammad-schema.mjs`: exporta o recorte do Zammad (grupos, atributos, Core Workflows; só leituras e
  sem dados pessoais) para os testes.

### Segurança
- Toda escrita no Zammad exige, no tipo e na execução, a pessoa que age (`X-On-Behalf-Of`): o histórico do Zammad
  mostra sempre o autor real.

### Atenção
- **A Prioridade sugerida passa a ser perguntada ao solicitante**: no Zammad da FEM ela é obrigatória para o cliente
  na criação (o portal não a enviava, e o Zammad a exigia).
- Conferido contra o recorte REAL do Zammad da FEM de 27/11/2026 (`shared/__fixtures__/fem-schema-live.ts`, testes em
  `form-live.test.ts`): Desenvolvimento (ferramenta e telas condicionais), Suporte, Infraestrutura e Acesso a sistemas,
  e as regras da tela de edição que a próxima versão usa (tempo/prazo ao atribuir ou iniciar, motivo da pausa).
- `pre_condition: current_user.id` nas condições (regra 612 da FEM) passa a ser avaliada.
- `tempo_previsto`, `prazo_entrega` e `motivo_pausa` nunca são perguntados na abertura (nem no chamado filho).

## v1.10.1

### Correções
- **Voltar no chamado filho** leva ao chamado pai (e, numa cadeia de filhos, passo a passo até o chamado raiz, que
  então volta para a lista), em vez de ir sempre para "Atribuídos a mim". O botão diz para onde leva ("Voltar ao
  chamado pai #N").

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
