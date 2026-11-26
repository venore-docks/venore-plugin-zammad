# Changelog

Versões anteriores: ver o histórico do git (tags `vX.Y.Z`).

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
