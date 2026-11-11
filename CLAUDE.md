# @venore/plugin-zammad — instruções para o Claude

Plugin do Venore Docks, instalado no core como dependência git (`@venore/plugin-zammad`). Este repo
não roda sozinho: typecheck, lint e build rodam **a partir do core**. Visão geral: `README.md`.

## Regras de arquitetura

São as mesmas do core: `AGENTS.md` (camadas handler → service, `OperationResult<T>`),
`.claude/rules/plugin-routes.md` (toda rota em `routes/route-table.ts`) e
`.claude/rules/css-tokens.md` (só tokens shadcn).

## Pontos que importam

- **O Zammad é a fonte da verdade dos campos.** O plugin não duplica formulário. O setting
  `zammad.wizard` guarda só a apresentação: etapas, ajudas, nomes e setores ocultos. A chave de um
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

Sem `npm install`, a rede para o GitHub é instável aqui:

```powershell
cd ..\venore-docks
# backup de package.json e package-lock.json antes (podem ter mudanças de outro trabalho)
New-Item -ItemType Junction -Path node_modules\@venore\plugin-zammad -Target ..\venore-plugin-zammad
New-Item -ItemType Junction -Path ..\venore-plugin-zammad\node_modules -Target .\node_modules
npm pkg set "dependencies.@venore/plugin-zammad=file:../venore-plugin-zammad"
npm run gen:registries; npx tsc --noEmit
# lint: o eslint do core ignora arquivos fora dele. Copie o plugin para src/plugins/_lint-zammad,
# rode `npx eslint src/plugins/_lint-zammad` e apague a cópia.
# depois: remover os dois junctions, restaurar package.json/lock e rodar npm run gen:registries
```

Testes: `.\scripts\run-tests.ps1` (cria e remove sozinho o junction de node_modules).

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
- **Escrita NÃO testada contra o Zammad real** (responder, encerrar, reabrir): o cliente só pode usar
  os estados `new` e `closed`; reabrir = `new`. Se algum falhar, ver o erro em `/chamados/:id`.
- **Cores**: só tokens do tema (`chart-1/2/6/7`, `success`, `warning`, `primary`) em
  `routes/public/palette.ts` e `shared.tsx`. Classes do Tailwind por extenso (nunca montadas por
  string). Ícone por nome do setor via `sectorIcon()` (função de renderização, não componente).
- **Etapas automáticas**: `autoSteps` em `shared/form.ts` (escolhas sozinhas, datas juntas, rápidas em
  lotes de 3, opcionais no fim); mudar a regra exige atualizar `form.test.ts`.
- **Heredoc no Bash**: código com `\s`, `\n` ou crases em `cat <<EOF`/`node -` perde as barras — use a
  ferramenta Write/Edit.
