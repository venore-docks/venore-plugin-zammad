# @venore/plugin-colabora — instruções para o Claude

Plugin do Venore Docks, instalado no core como dependência git (`@venore/plugin-colabora`). Este repo
não roda sozinho: typecheck, lint e build rodam **a partir do core**. Visão geral: `README.md`.

## Regras de arquitetura

São as mesmas do core: `AGENTS.md` (camadas handler → service, `OperationResult<T>`),
`.claude/rules/plugin-routes.md` (toda rota em `routes/route-table.ts`) e
`.claude/rules/css-tokens.md` (só tokens shadcn).

## Pontos que importam

- **O Zammad é a fonte da verdade dos campos.** O plugin não duplica formulário. O setting
  `colabora.wizard` guarda só a apresentação: etapas, ajudas, nomes e setores ocultos. A chave de um
  campo que sumiu do Zammad é ignorada sem erro.
- **Toda ação da pessoa vai com `X-On-Behalf-Of`** (`shared/zammad-client.ts`). O dono do token pode
  não ter acesso a nenhum grupo: no Zammad da FEM, o admin tem `group_ids: {}` e por isso enxerga
  0 tickets. Sem o header, a busca volta vazia e a criação esbarra em permissão de grupo.
- **`/core_workflows/perform` não aceita token** (testado no 7.2.2: "Token authorization failed").
  Por isso existe `shared/workflow.ts`. Ao estender esse avaliador, adicione um caso em
  `workflow.test.ts`, que roda contra o recorte real em `shared/__fixtures__/fem-schema.ts`.
- **O servidor remonta o formulário** em `create-ticket` (setor, campos visíveis e obrigatórios)
  e não confia no que vem do navegador. As regras de validação ficam em `shared/answers.ts`, que é
  puro e é usado pelos dois lados.
- **Datas e horas**: `datetime-local` não tem fuso, e o plugin fixa `-03:00` (`LOCAL_UTC_OFFSET`).
  Booleanos nunca vêm pré-marcados, para que a pessoa responda de fato.
- **Settings são de leitura pública**: segredo nunca vai em setting, só em variável de ambiente.

## Verificar contra o core

**Sempre pelo PowerShell** (no Git Bash o vitest do core falha com erros enganosos) e **com o script**, que é
seguro para uso em paralelo (mutex global; restaura o core ao fim; nunca faz build nem toca banco):

```powershell
powershell -NoProfile -File scripts\verify.ps1                      # testes + tsc + lint deste repo
powershell -NoProfile -File scripts\verify.ps1 -Plugin C:\caminho   # de outra cópia/worktree do plugin
powershell -NoProfile -File scripts\verify.ps1 -Only tsc            # só uma etapa (tests | tsc | lint)
```

Dura 1–2 min (e pode esperar a vez de outra verificação). Termina com o bloco `VERIFY` e código de saída
diferente de zero se algo falhou. Não rode `npm install`/`npm run build` e não crie junctions à mão.

## Estrutura do Colabora (v1.0)

Chave do plugin: **`colabora`** (a rota de admin é `/admin/<chave>`). Antes era `zammad`; as permissões
`zammad.*` e o setting `zammad.wizard` antigos ainda são aceitos/lidos como reserva (`shared/permissions.ts`,
`shared/wizard-config.ts`).

Uma só base de telas, **duas superfícies**: o **portal** (`/colabora/…`, dentro da casca do Venore Docks) e o **app
PWA** (`/ext/colabora/app/…`, sem a casca). Mesmos caminhos relativos, mesmas telas, moldura diferente
(`shared/routes.ts`: `PORTAL_SURFACE`/`APP_SURFACE`; o código recebe só `surfaceKey: "portal" | "app"`).

- `routes/views/*` — as telas (server components) compartilhadas: `dashboard-view`, `my-tickets-view`,
  `new-ticket-view`, `ticket-view`, `assigned-view`, `queue-view`, `team-view`, `team-agent-view`;
  `dashboards/{customer,agent,manager}-dashboard`; moldura `frame.tsx` (portal = pílulas, app = `routes/app/shell.tsx`
  com abas); navegação por papel `nav.ts`; entrada com login+papel `context.ts` (`enterSurface`); consulta
  `query.ts`.
- `routes/entries.tsx` liga rota → view; `routes/route-table.ts` declara as rotas; `routes/legacy.tsx` redireciona
  os endereços antigos (`/chamados…`, `/ext/zammad/app…`).
- `routes/public/*` — peças de UI compartilhadas (conversa, caixa de resposta, wizard, lista, paleta). O nome da
  pasta é histórico.
- **Papéis** (`shared/access-rules.ts`): `customer` | `agent` | `manager` | `admin` (viewer do `getAppViewer`).
  Todos têm `colabora.tickets` (papel "Colaborador"); agente/gestor/admin vêm dos papéis do **Zammad**.
- **Dashboards por papel**: colaborador → `CustomerDashboard`; agente → `AgentDashboard` + `CustomerDashboard compact`;
  gestor/admin → `ManagerDashboard` + `CustomerDashboard compact`.
- Regras de UI: tokens do tema apenas (nunca hex/rgb), Tailwind com classes literais, mobile-first (base sem prefixo
  e depois `sm:` `md:` `lg:`), propriedades lógicas (`ms-`/`ps-`/`start-`), acessível (labels, aria, foco visível).
  As telas servem ao desktop (`max-w-5xl`) E ao celular (`max-w-2xl`, PWA).

## Frentes de trabalho em paralelo (branch `feat/colabora`)

Cada frente trabalha numa worktree própria (`C:\dev\venore\_wt\colabora-<frente>`) e só edita os SEUS arquivos;
compartilhados (`routes/route-table.ts` fora do `admin:`, `entries.tsx`, `legacy.tsx`, `views/{frame,nav,context,
query,dashboard-view,ticket-view}`, `routes/app/shell.tsx`, `index.ts`) ficam com o dono da integração.

## Versão

`package.json#version` = tag `vX.Y.Z` = `manifest.ts#version`. O workflow `tag-release` cria a tag
quando a versão nova chega no `main`. O repo precisa ser **público**, senão o install na Vercel falha.

## Conversa do chamado (v0.2.0)

- **Zammad headless**: nenhuma tela linka para o Zammad. Todo acesso a UM chamado passa por
  `shared/own-ticket.ts` (`loadOwnTicket` exige `customer_id` = a pessoa; 404 igual para alheio) e só
  lê artigos públicos (`loadPublicArticles`). A rota de anexo (`routes/api/attachment.ts`) revalida
  ticket + artigo público + anexo antes de repassar o stream.
- **Autor da mensagem** = `created_by_id` do artigo (não `sender`: um agente que abre o próprio
  chamado aparece como `Agent`). HTML dos artigos vira texto em `shared/html-text.ts` (nunca renderize
  o HTML do Zammad).
- **Escrita NÃO testada contra o Zammad real** (responder, encerrar, reabrir). Encerrar/reabrir só
  para quem tem `ticket.agent`/`admin` (`canManageTicketState` em `shared/own-ticket.ts`, lê
  `GET /roles?expand=true`; vale no botão e no servidor). Estados via `new`/`closed` por nome.
  Resposta em chamado encerrado tenta reabrir (best-effort).
- **Resumo das respostas** no 1º artigo (`composeBody`) é extraído por `extractFormAnswers`
  (`shared/html-text.ts`) e exibido como lista; mudar o formato do resumo exige mudar os dois.
- **"Responder" a uma mensagem da equipe** (como no WhatsApp): o navegador manda só o `quoteArticleId`;
  o servidor lê a mensagem e monta o bloco `<blockquote><p><strong>autor</strong></p><p>trecho</p>
  </blockquote>` no INÍCIO do corpo (`composeReplyBody` em `answers.ts`). Para a equipe é uma citação
  normal no Zammad; o portal a extrai (`extractReplyQuote`, só em mensagens da própria pessoa) e
  mostra como cartão, linkando (`#msg-<id>`) à mensagem original achada por autor + trecho
  (`linkQuotes`). Os dois lados dependem desse formato — mude os dois juntos.
- **App do agente/gestor (PWA)** em `routes/app/`. Papéis (`shared/access-rules.ts`, puro e testado):
  `customer` | `agent` | `manager` | `admin`, derivados dos papéis do Zammad por `staffRoleOf` (`admin` >
  `report` > `ticket.agent`). **Agente só vê/trabalha o que está COM ele; NÃO vê a fila (owner_id 1) nem
  aloca.** Só gestor/admin veem fila e equipe, alocam (`ownerId` em `agent-update-ticket`, destino validado
  por `assigneesFor`) e mexem em estado/prioridade de chamado alheio; responder/nota só no chamado dele
  (`canWorkTicket`). Toda leitura de chamado: `loadTicketForViewer(requester, id, asAgent)`; notas
  internas só com `includeInternal`. Resposta pública do agente = artigo `email` com `to`; nota = `note`
  interna; **nunca** citar nota interna em resposta pública. Escritas do agente/gestor NÃO foram testadas
  no Zammad real (só leituras: busca `owner_id:`, papéis, `users/search?query=role_ids:`).
- **Diretório** (`shared/directory.ts` + `team-rules.ts`): papéis (`roles?expand=true`) e a EQUIPE por busca
  `users/search?query=role_ids:N` (lista completa de usuários passa de 500 e leva ~10 s/página — não usar).
  Acesso a grupo = usuário ∪ papéis; "dono" do grupo = `full`/`change`. Cache de 5 min.
- **Ícone/nome do app**: ícone = `brand.pwaIconUrl` (Identidade do site; senão o favicon) renderizado por
  `next/og` em `/api/colabora/app/icon`
  (`shared/icon-source.ts`: formato pelos bytes; .ico → quadro PNG); nome = setting `colabora.wizard.appName`
  (admin), senão "Chamados · <site>". Ambos públicos (o navegador busca manifest/ícone sem cookies).
- **PWA**: a página é servida por `/ext` (área `standalone`) e declara `generateMetadata` → `manifest`
  próprio (precisa do core com `generateMetadata` em standalone). O manifest é PÚBLICO (o navegador o busca
  sem cookies) e deriva cores/ícones do `/manifest.webmanifest` do core (`shared/app-manifest.ts`).
  Caminhos das duas superfícies em `shared/routes.ts`; o wizard recebe só `surface: "portal" | "app"`
  (função não atravessa servidor→cliente). Actions revalidam as DUAS superfícies.
- **Cores**: só tokens do tema (`chart-1/2/6/7`, `success`, `warning`, `primary`) em
  `routes/public/palette.ts` e `shared.tsx`. Classes do Tailwind por extenso (nunca montadas por
  string). Ícone por nome do setor via `sectorIcon()` (função de renderização, não componente).
- **Etapas automáticas**: `autoSteps` em `shared/form.ts` (escolhas sozinhas, datas juntas, rápidas em
  lotes de 3, opcionais no fim); mudar a regra exige atualizar `form.test.ts`.
- **Heredoc no Bash**: código com `\s`, `\n` ou crases em `cat <<EOF`/`node -` perde as barras — use a
  ferramenta Write/Edit.
