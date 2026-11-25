# Changelog

Versões anteriores: ver o histórico do git (tags `vX.Y.Z`).

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
