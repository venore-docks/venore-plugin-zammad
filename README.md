# @venore/plugin-colabora — Chamados

Plugin do [Venore Docks](https://github.com/venore-docks/venore-docks) que abre e acompanha chamados
no [Zammad](https://zammad.org) **sem o colaborador nunca ver o Zammad**: o Zammad fica "headless" (só
o motor e a fila da equipe) e toda a experiência do solicitante acontece no portal.

## Telas

As mesmas telas existem no portal (`/colabora/...`, dentro da casca do site) e no app (`/ext/colabora/app/...`):

| Rota | Quem | O que é |
|---|---|---|
| `/colabora` | todos | **Início**: dashboard do papel. Colaborador: "Abrir chamado" em destaque, setores liberados e resumo dos seus chamados. Agente: "Meu atendimento" (KPIs, precisam da sua resposta, em andamento). Gestor/admin: "Gestão da equipe" (fila, carga por agente, mais antigos com alocação rápida). Agente e gestor também veem o resumo de colaborador. |
| `/colabora/novo` | todos | Abertura guiada (Setor → Detalhes → Pedido → Revisão). `?setor=<id do grupo>` já começa no setor. |
| `/colabora/meus` | todos | Os chamados da pessoa ("sua vez", "em andamento", "encerrados"). |
| `/colabora/atribuidos` | agente+ | O que está com ele, com filtros e ações rápidas. |
| `/colabora/fila` | gestor+ | Sem responsável nos setores que gerencia; filtros `?setor=` e `?ordem=idade\|prioridade`; alocação na linha. |
| `/colabora/equipe`, `/colabora/equipe/:id` | gestor+ | Cartões por agente (setores, carga) e a lista de cada um. |
| `/colabora/chamado/:id` | conforme o papel | A conversa (responder, citar, anexos); para quem atende: estado, prioridade e ações rápidas; para gestor: alocação. |
| `/admin/colabora` | admin do plugin | A administração (veja abaixo). |

Os endereços antigos (`/chamados`, `/chamados/novo`, `/chamados/:id`, `/ext/zammad/app...`) redirecionam para os novos.

Nenhuma tela leva ao Zammad. Anexos são servidos pelo próprio portal
(`/api/colabora/tickets/:t/articles/:a/attachments/:id`), só para o dono do chamado. As notificações
por e-mail do Zammad continuam saindo; os links dentro dos e-mails apontam para o Zammad, então
**desligue o link/`ticket_hook` dos templates de notificação do cliente** ou troque-os por um link
para `/colabora`.

## App Colabora (PWA, fora da casca do portal)

Uma superfície própria para celular, instalável como app: **`/ext/colabora/app`**. Ela roda sob o `/ext` do
core (rotas `standalone`), então **não leva a casca do Venore Docks** (sem menu, cabeçalho nem rodapé do
portal) — só o cabeçalho e a barra de abas do app, com respeito à área segura do celular.

| Quem (papel no Zammad) | O que vê e faz |
|---|---|
| **Colaborador** | **Meus** (conversa, responder, citar) e **Novo** (o mesmo passo a passo do portal) |
| **Agente** (`ticket.agent`) | tudo isso + **Atribuídos**: SÓ os chamados que foram atribuídos a ele. Responde ao solicitante (e-mail) ou escreve nota interna, muda estado (com data nos "pendente") e prioridade. **Não vê a fila e não aloca** — nem assume chamado. |
| **Gestor** (papel com `report` + `ticket.agent`) | tudo do agente + **Fila** (sem responsável, nos setores que ele gerencia) + **Equipe** (cada agente e a carga: abertos e aguardando). **Aloca**: atribui a um agente do setor, realoca ou devolve à fila. Acompanha estado e prioridade dos chamados da equipe; só RESPONDE o que está com ele. |
| **Admin** (`admin`) | como o gestor, sobre o que a conta admin enxerga no Zammad |

Quem é agente, gestor ou admin vem dos **papéis do Zammad** (nada a configurar aqui): `admin` > `report` >
`ticket.agent`. O acesso a um setor é a união do que o usuário e os papéis dele têm; só quem tem acesso
`full`/`change` ao grupo pode receber chamados dele. Chamado atribuído a outro agente não aparece para
agente comum (quem quiser ver usa o Zammad).

- **Nome e ícone:** o nome vem de **/admin/colabora → Nome do app (PWA)** (ex.: "Colabora FEM"); o ícone é o **"Ícone do app (PWA)"**
  de Configurações → Identidade do site (sem ele, o **favicon**), desenhado em PNG 192/512/180 por
  `/api/colabora/app/icon` (aceita PNG, JPEG, GIF, SVG e .ico com quadro PNG; outro formato cai no ícone padrão do
  core). Imagem sem transparência preenche o ícone inteiro. Requer o core com `brand.pwaIconMediaId`.
- **Instalar:** abrir `/ext/colabora/app` no celular e usar "Instalar" (Android/Chrome) ou "Compartilhar →
  Adicionar à Tela de Início" (iOS). A página aponta para o manifest próprio
  (`/api/colabora/app/manifest`), montado a partir do manifest do site (cores, ícones e idioma do tema) com
  nome, id e página inicial do app. O service worker é o do core (escopo `/`).
- **Login:** a página de login é a do portal (mesma conta). O manifest usa `scope: "/"` para o login não
  abrir uma barra de endereço por cima do app.
- **Exige no core:** rotas `standalone` com `generateMetadata` (core ≥ commit `78b2276`).
- **Ainda não tem:** notificação push de "novo chamado atribuído" (a infra de push do core existe; falta
  o webhook do Zammad) e modo offline (o core mostra a página `/offline`).

## Administração (`/admin/colabora`)

Exige `colabora.settings.manage`. Subrotas server-rendered, com a mesma moldura (cabeçalho + abas):

| Rota | O que faz |
|---|---|
| `/admin/colabora` | **Visão geral**: saúde da conexão com o Zammad (dono do token, última leitura dos campos, "Recarregar do Zammad"), contagens (setores ativos, grupos de pessoas, agentes/gestores, regras não suportadas) e **próximos passos** acionáveis (`shared/admin-hints.ts`). |
| `/admin/colabora/setores` | Cartões dos setores: perguntas/etapas, selo de **audiência** ("Todos", "Só: TI, RH", "Oculto"), liga/desliga e "Testar" (`/colabora/novo?setor=ID`). |
| `/admin/colabora/setores/:groupId` | Edição do setor: nome, ordem, descrição, dicas, etapas e ajudas por campo, e **quem vê o setor**. |
| `/admin/colabora/grupos` | **Grupos de pessoas** (lista + criar). |
| `/admin/colabora/grupos/:groupId` | Editor do grupo: dados, membros (busca por nome/e-mail ou colagem de e-mails), **setores liberados** e exclusão. |
| `/admin/colabora/app` | Nome do app (PWA), de onde vem o ícone (Identidade do site) e como instalar. |
| `/admin/colabora/textos` | Texto de abertura do assistente. |

### Grupos de pessoas e audiência dos setores

Todos os usuários são "Colaboradores", mas nem todos devem abrir chamados em todos os setores (ex.: só a equipe
de TI abre chamados para o TI). Por isso:

- **Grupo de pessoas** (`PeopleGroup`): `id`, `name`, `description`, `memberIds` (ids de usuário do Venore) e
  `createdAt`, no setting `colabora.groups`. O setting é de leitura pública no core, então guarda **só ids**; nome,
  e-mail e avatar são resolvidos na hora (`searchUsers`/`findUserByEmail` do SDK) e só chegam à tela do admin.
- **Audiência do setor** (`audience` em `GroupWizardConfig`, no setting `colabora.wizard`): `mode` = `all`
  (todos), `groups` (só os grupos de `groupIds`) ou `inherit` (usa a do setor pai; setor raiz com `inherit` = todos).
  Sem `audience` na config antiga, vale `inherit` (= todos): nada muda para quem já usava.
- **Regra** (`shared/audience.ts`, pura e testada): o setor é visível se o modo é `all`, ou se a pessoa está em algum
  dos grupos listados. `groups` sem nenhum grupo = ninguém. **Quem tem `colabora.settings.manage` vê todos os
  setores** (serve de prévia). A herança pai → filho é resolvida na árvore de grupos do Zammad.
- **Onde vale**: `getWizard` só devolve os setores permitidos, e `createTicket` recusa um setor não permitido
  ("Este setor não recebe chamados de você."), pois o servidor remonta o formulário.
- **Excluir um grupo** tira a referência dos setores; um setor que só listava esse grupo fica sem ninguém (aparece
  como "Oculto" no admin e em "Próximos passos"), nunca vira "todos" sozinho.
- **Marcar um setor** em "Setores liberados" de um grupo, quando ele era "Todos", passa a restringi-lo aos grupos
  escolhidos (o editor avisa).

### Ver como (só leitura)

Quem tem `colabora.settings.manage` vê o botão **"Ver como…"** no Início do Colabora. Escolhida uma pessoa do portal,
todas as telas passam a ser **as dela**: setores liberados (a prévia de admin é desligada), chamados, papel no
atendimento (agente/gestor), fila e equipe. Uma faixa fixa mostra "Vendo como Fulano · só leitura" com **Sair**.

- **Só leitura:** abrir, responder, encerrar/reabrir e alterar/alocar são recusados no servidor
  (`resolveRequester({ write: true })`); no detalhe, a caixa de resposta vira um aviso.
- **Cookie** `colabora_view_as`: httpOnly, assinado (HMAC com `COLABORA_VIEW_AS_SECRET`, ou `AUTH_SECRET`), vale 2 h e
  só para a sessão do admin que o criou. A permissão de admin é conferida de novo a cada request.
- A pessoa vista precisa ter conta no Zammad (mesmo e-mail) e `colabora.tickets`; senão a tela explica o motivo.

## Quem manda em quê

| O quê | Onde |
|---|---|
| Setores | **Grupos** do Zammad |
| Perguntas, opções, obrigatoriedade | **Atributos de ticket** + **Core Workflows** do Zammad, lidos pela API |
| Ordem das etapas, textos de ajuda, nome/descrição do setor, setores ocultos, audiência dos setores | Plugin (setting `colabora.wizard`) |
| Grupos de pessoas (quem pertence a quê) | Plugin (setting `colabora.groups`, só ids de usuário) |

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

- `colabora.tickets`: usar o Colabora. Dar ao papel de todos os colaboradores (agentes e gestores inclusive: o
  papel no atendimento vem do Zammad, não do portal).
- `colabora.settings.manage`: administração, prévia de todos os setores e "ver como".
- As chaves antigas `zammad.tickets` / `zammad.settings.manage` continuam aceitas.

Coloque um item de menu apontando para `/colabora` (menus do CMS).

## Anexos

São até 5 arquivos, com 8 MB no total, tanto na abertura quanto nas respostas. Eles vão em base64
no artigo. O limite fica abaixo dos 10 MB de `serverActions.bodySizeLimit` do core.

## Desenvolvimento

O plugin não roda sozinho. Veja `CLAUDE.md`.

```powershell
.\scripts\run-tests.ps1           # testes unitários contra o recorte real em shared/__fixtures__
```
