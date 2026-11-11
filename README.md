# @venore/plugin-zammad — Chamados

Plugin do [Venore Docks](https://github.com/venore-docks/venore-docks) que abre e acompanha chamados
no [Zammad](https://zammad.org) **sem o colaborador nunca ver o Zammad**: o Zammad fica "headless" (só
o motor e a fila da equipe) e toda a experiência do solicitante acontece no portal.

## Telas

- **`/chamados/novo`**: abertura guiada, com fases coloridas (Setor → Detalhes → Pedido → Revisão):
  1. **Setor**, em cartões coloridos com ícone. Subgrupos (ex.: `Eventos::Som e Projeção`) viram
     uma sub-escolha. `?setor=<id do grupo>` já começa no setor.
  2. **Perguntas do setor**, vindas do Zammad e agrupadas em poucas etapas (ver abaixo).
  3. **Pedido**: título + descrição (com dicas do setor) + anexos, numa tela só.
  4. **Revisão**, com "Alterar" em cada item e o que acontece depois de enviar.
- **`/chamados`**: os chamados da pessoa, separados em "A equipe respondeu — sua vez", "Em andamento" e
  "Encerrados".
- **`/chamados/:id`**: a conversa. Mensagens da equipe e da pessoa, anexos (imagens em miniatura),
  responder (com anexos) e, **só para agente/admin do Zammad** (papel com `ticket.agent` ou `admin`),
  **encerrar** (com confirmação) e **reabrir**. Colaborador comum apenas conversa; o botão nem aparece
  e o servidor também recusa.
- **`/admin/zammad`**: estado da conexão, setores visíveis, agrupamento das perguntas em etapas,
  textos de ajuda e regras do Zammad que o portal não sabe aplicar.

Nenhuma tela leva ao Zammad. Anexos são servidos pelo próprio portal
(`/api/zammad/tickets/:t/articles/:a/attachments/:id`), só para o dono do chamado. As notificações
por e-mail do Zammad continuam saindo; os links dentro dos e-mails apontam para o Zammad, então
**desligue o link/`ticket_hook` dos templates de notificação do cliente** ou troque-os por um link
para `/chamados`.

## Quem manda em quê

| O quê | Onde |
|---|---|
| Setores | **Grupos** do Zammad |
| Perguntas, opções, obrigatoriedade | **Atributos de ticket** + **Core Workflows** do Zammad, lidos pela API |
| Ordem das etapas, textos de ajuda, nome/descrição do setor, setores ocultos | Plugin (setting `zammad.wizard`) |

Criar ou mudar um campo no Zammad aparece no portal em até 5 minutos, ou na hora com
"Recarregar do Zammad" no admin. Não é preciso deploy.

### Como as perguntas viram etapas

Sem configuração, `shared/form.ts` agrupa sozinho: cada pergunta de **escolha** fica sozinha, as
**datas** vão juntas, as perguntas **rápidas** (sim/não, texto) vão em lotes de 3, e tudo que é
**opcional** fica numa etapa só, no fim. O admin pode forçar números de etapa por campo.

O endpoint de Core Workflows do Zammad (`/core_workflows/perform`) não aceita token. Por isso o
plugin lê as regras e as aplica localmente (`shared/workflow.ts`). Ele suporta condições
`ticket.*` e `session.role_ids` (is, is not, is set, not set, modo expert AND/OR/NOT) e as ações
show, hide, remove, set_mandatory, set_optional, set_fixed_to, add_option, remove_option e fill_in.
O que estiver fora disso aparece no admin como "regra não aplicada".

## Configuração

Variáveis de ambiente do projeto (Vercel):

```
ZAMMAD_URL=https://colabora.fem.edu.br
ZAMMAD_API_TOKEN=<token de acesso>
```

O token deve ser de um **usuário técnico** do Zammad (Perfil → Acesso por token) com as
permissões:
- `admin.user`: agir **em nome da pessoa** (`X-On-Behalf-Of: <e-mail>`). O Zammad aplica as
  permissões dela e registra tudo como feito por ela.
- `admin.object` e `admin.core_workflow`: ler atributos e Core Workflows.

O token nunca vai para o navegador nem para os settings, que têm leitura pública no core.

As contas do portal e do Zammad são casadas pelo **e-mail**. Quem não tem conta no Zammad recebe
uma mensagem para procurar o suporte.

### Segurança dos chamados

- A pessoa só vê, responde e baixa anexos de chamados em que ela é o **solicitante** (`customer_id`).
  Chamado alheio responde "não encontrado", igual a chamado inexistente.
- Só artigos **públicos** aparecem: notas internas da equipe nunca chegam ao portal.
- O HTML das mensagens (e-mails) é convertido para **texto**: nada de HTML de terceiros no portal.
- Anexos: só imagens "seguras" (png/jpg/gif/webp/bmp) abrem no navegador; o resto baixa, com
  `nosniff` e CSP restritiva.

### Permissões (RBAC do portal)

- `zammad.tickets`: abrir, acompanhar e responder os próprios chamados. Dar ao papel de todos os
  colaboradores.
- `zammad.settings.manage`: tela de configuração.

Coloque um item de menu apontando para `/chamados` (menus do CMS).

## Anexos

São até 5 arquivos, com 8 MB no total, tanto na abertura quanto nas respostas. Eles vão em base64
no artigo. O limite fica abaixo dos 10 MB de `serverActions.bodySizeLimit` do core.

## Desenvolvimento

O plugin não roda sozinho. Veja `CLAUDE.md`.

```powershell
.\scripts\run-tests.ps1           # testes unitários contra o recorte real em shared/__fixtures__
```
