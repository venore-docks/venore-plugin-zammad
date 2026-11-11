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

## App "Chamados" (PWA, fora da casca do portal)

Uma superfície própria para celular, instalável como app: **`/ext/zammad/app`**. Ela roda sob o `/ext` do
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

- **Nome e ícone:** o nome vem de **/admin/zammad → Nome do app (PWA)** (ex.: "Colabora FEM"); o ícone é o **"Ícone do app (PWA)"**
  de Configurações → Identidade do site (sem ele, o **favicon**), desenhado em PNG 192/512/180 por
  `/api/zammad/app/icon` (aceita PNG, JPEG, GIF, SVG e .ico com quadro PNG; outro formato cai no ícone padrão do
  core). Imagem sem transparência preenche o ícone inteiro. Requer o core com `brand.pwaIconMediaId`.
- **Instalar:** abrir `/ext/zammad/app` no celular e usar "Instalar" (Android/Chrome) ou "Compartilhar →
  Adicionar à Tela de Início" (iOS). A página aponta para o manifest próprio
  (`/api/zammad/app/manifest`), montado a partir do manifest do site (cores, ícones e idioma do tema) com
  nome, id e página inicial do app. O service worker é o do core (escopo `/`).
- **Login:** a página de login é a do portal (mesma conta). O manifest usa `scope: "/"` para o login não
  abrir uma barra de endereço por cima do app.
- **Exige no core:** rotas `standalone` com `generateMetadata` (core ≥ commit `78b2276`).
- **Ainda não tem:** notificação push de "novo chamado atribuído" (a infra de push do core existe; falta
  o webhook do Zammad) e modo offline (o core mostra a página `/offline`).

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
