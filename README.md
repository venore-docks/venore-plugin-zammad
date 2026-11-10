# @venore/plugin-zammad — Chamados

Plugin do [Venore Docks](https://github.com/venore-docks/venore-docks) que abre chamados no
[Zammad](https://zammad.org) por um **passo a passo guiado**: a pessoa escolhe o setor e responde
uma pergunta por vez, em vez de encarar o formulário inteiro do Zammad.

- `/chamados/novo`: abertura guiada. As etapas são: setor → perguntas do setor → descrição e anexos
  → título (com sugestão) → revisão. `?setor=<id do grupo>` já começa no setor.
- `/chamados`: os chamados que a pessoa abriu, com o estado e o link para o Zammad.
- `/admin/zammad`: estado da conexão, setores visíveis, agrupamento das perguntas em etapas,
  textos de ajuda e regras do Zammad que o portal não sabe aplicar.

## Quem manda em quê

| O quê | Onde |
|---|---|
| Setores | **Grupos** do Zammad (subgrupo `Eventos::Som e Projeção` vira sub-escolha de Eventos) |
| Perguntas, opções, obrigatoriedade | **Atributos de ticket** + **Core Workflows** do Zammad, lidos pela API |
| Ordem das etapas, textos de ajuda, nome/descrição do setor, setores ocultos | Plugin (setting `zammad.wizard`) |

Criar ou mudar um campo no Zammad aparece no portal em até 5 minutos, ou na hora com
"Recarregar do Zammad" no admin. Não é preciso deploy.

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
- `admin.user`: abrir e listar chamados **em nome da pessoa** (`X-On-Behalf-Of: <e-mail>`). O
  Zammad aplica as permissões dela e registra o chamado como aberto por ela.
- `admin.object` e `admin.core_workflow`: ler atributos e Core Workflows.

O token nunca vai para o navegador nem para os settings, que têm leitura pública no core.

As contas do portal e do Zammad são casadas pelo **e-mail**. Quem não tem conta no Zammad recebe
uma mensagem para procurar o suporte.

### Permissões (RBAC do portal)

- `zammad.tickets`: abrir e acompanhar os próprios chamados. Dar ao papel de todos os colaboradores.
- `zammad.settings.manage`: tela de configuração.

Coloque um item de menu apontando para `/chamados` (menus do CMS).

## Anexos

São até 5 arquivos, com 8 MB no total. Eles vão em base64 no primeiro artigo do ticket. O limite
fica abaixo dos 10 MB de `serverActions.bodySizeLimit` do core.

## Desenvolvimento

O plugin não roda sozinho. Veja `CLAUDE.md`.

```powershell
.\scripts\run-tests.ps1           # testes unitários contra o recorte real em shared/__fixtures__
```
