# Zammad da FEM × Colabora — configuração e contrato

Documento para quem (pessoa ou agente) mexe no plugin `@venore/plugin-colabora` ou no Zammad da FEM
(`colabora.fem.edu.br`, Zammad 7.2.2). **Tudo da seção 1 foi feito à mão na UI do Zammad** (17/11/2026)
e não está em nenhum repositório: se o Zammad mudar, este arquivo e `shared/flow.ts` precisam acompanhar.

Leitura rápida: o **estado** do chamado é a espinha do fluxo; **gestor** decide (autoriza), **agente**
executa (conclui), **cliente** só reage por **palavras de controle** no assunto de um artigo, e quem muda o
estado são os **gatilhos** do Zammad. O plugin repete no servidor as regras que o Zammad só aplica na
própria tela.

---

## 1. Configuração do Zammad (UI)

### 1.1 Estados (Administração → Ticket → Estados)

| Estado | Tipo | Observação |
|---|---|---|
| Novo | novo | padrão para novos tickets; fila do gestor (agentes não trabalham) |
| Em análise | aberto | gestor analisando |
| Autorizado | aberto | gestor autorizou; falta responsável |
| Não autorizado | fechado | gestor negou (com motivo); cliente pode reenviar |
| Reavaliação | aberto | cliente reenviou um "não autorizado"; gestor decide de novo |
| Em andamento | aberto | padrão para acompanhamentos; responsável trabalhando |
| Concluído | aberto | entregue; aguardando o cliente (era "ação pendente", trocado para aberto) |
| Finalizado | fechado | padrão para fechados; cliente aprovou ou 48 h sem resposta |
| mesclado | mesclado | do sistema |

O plugin reconhece esses estados **por nome** (sem acento/caixa; "Nova" também vale). Renomear um estado
no Zammad quebra o fluxo no portal (o chamado cai no comportamento genérico).

### 1.2 Funções (Administração → Funções)

Convenção `<Setor> - <Papel>` para Manutenção, Marketing, Recursos Humanos e Tecnologia:

- `<Setor> - Administrador` = **gestor** do setor. Permissão `ticket.agent`; grupo do setor com **Completo**.
- `<Setor> - Agente` = executa. `ticket.agent`; grupo do setor com **Completo** (com só Leitura/Criar/Alterar
  o agente não aparecia na lista de Responsável deste Zammad).
- `<Setor> - Cliente` = pode abrir chamado no setor (`ticket.customer`).
- `Abrir chamado em todo setor` (criada como "Abertura - todos os setores"): `ticket.agent` com **Criar**
  em todos os grupos — para agentes/gestores abrirem chamado em OUTRO setor.
- Sobras a limpar quando der: `Agente da Inspetoria`, `Agente do Registro de Ocorrências`, `Padrão - Cliente`.

Funções somam. O cliente do próprio chamado sempre o enxerga. Um gestor que abre chamado em outro setor é
só o solicitante ali (o plugin trata isso — §3.4).

### 1.3 Grupos

`<Setor>` e `<Setor>::<categoria>`. Manutenção, Marketing, Recursos Humanos (Afastamento, Atualizações
Cadastrais, Benefícios, Planos de Cargos e Salários), Tecnologia (Suporte, Infraestrutura, Desenvolvimento —
**a confirmar com o Felipe**). "Seguimento possível" = **não** (Finalizado não reabre; abre-se outro).
O grupo raiz "RH" foi renomeado para **Recursos Humanos**.

### 1.4 Fluxos de trabalho principais (Core Workflows)

Só valem na **tela do Zammad**; a API ignora. Ordem: prioridade crescente, o último que mexe vence.

| Prio | Nome | Contexto | Regra |
|---|---|---|---|
| 501 | Definições para todos e ocultar campos específicos | — | legado |
| 504 | Registro de Ocorrência - Ticket | — | legado |
| 520 | Grupo ocultos para todos para clientes | criação | Grupo → remove todas as opções (exceto funções de equipe) |
| 521–524 | Grupo <Setor> visível para Função <Setor> - Cliente | criação | Grupo → adiciona o grupo do setor |
| 600 | Estado - Somente leitura para todos | criação + edição | Estado → somente leitura |
| 601, 603, 605, 607 | Estado - Habilitado para … - Administrador | criação + edição | Grupo é [setor] + Função é [Adm do setor] + Estado é [Novo, Em análise, Autorizado, Reavaliação] → remove somente leitura + fixa [Novo, Em análise, Autorizado, Não autorizado, Reavaliação] |
| 602, 604, 606, 606 | Estado - Habilitado para … - Agente | criação + edição | … Função é [Agente do setor] + Estado é [Em andamento, Concluído] → remove somente leitura + fixa [Em andamento, Concluído] (renumerar um dos 606) |
| 610 | Prioridade sugerida - Mostrar para clientes na criação | criação | |
| 611 | Prioridade - Somente leitura para todos | edição | |
| 612 | Prioridade - Editável para agentes e administradores | edição | |
| 700–730 | Formulário - Manutenção / Marketing / Tecnologia / Recursos Humanos | | campos específicos de cada setor (ex.: "Local de uso") — **conferir se mexem em Estado/Responsável** |

Pegadinhas que custaram tempo:
- Condição **Estado é** precisa listar o estado ATUAL (faltar "Novo" deixou o gestor travado).
- "Remover somente leitura" sem "fixar opções" mostra **todos** os estados (inclusive Finalizado).
- Mudou fluxo/função? **Ctrl+F5** (ou sair e entrar): o Zammad guarda isso na sessão do navegador.
- Na tela do cliente o campo Estado mostra só a lista reduzida do Zammad (aparece "Em andamento" mesmo
  em Concluído) e **envia esse valor ao clicar em Atualizar** — por isso o cliente usa só o portal.
- A Prioridade nativa não pode ser mostrada ao cliente na criação (nem por fluxo, nem em Objetos).

### 1.5 Objetos (campos do Ticket)

- `prioridade_sugerida` ("Prioridade sugerida", seleção baixa/normal/alta/urgente, padrão normal): cliente
  vê e preenche na criação; somente leitura depois (611). O portal pergunta automaticamente.
- `prioridade_cliente` ("Prioridade inicial"): antigo, abandonado — o portal nunca pergunta.
- `Data sugerida para atendimento`, `Local de uso` (Manutenção) e outros campos por setor.

### 1.6 Gatilhos (Administração → Gatilho)

Palavras de controle no **Assunto** do artigo do cliente (o plugin manda; ver §2):

| Gatilho | Condições | Ações |
|---|---|---|
| Estado do Ticket - Cliente aprova (Concluído → Finalizado) | Estado é Concluído; Remetente é Cliente; Assunto contém `[APROVADO]` | Estado → Finalizado |
| … Cliente pede ajustes (Concluído → Em andamento - tag ajustes) | Estado é Concluído; Remetente é Cliente; Assunto **não contém** `[APROVADO]`, `[REJEITADO]`, `[NAO_RESOLVIDO]` (reserva: qualquer mensagem solta) | Em andamento; tag `ajustes`; e-mail interno ao Responsável `[AJUSTAR] #{ticket.title}` |
| … Cliente rejeita (Concluído → Em análise - tag rejeitado) | … `[REJEITADO]` | Em análise; tag `rejeitado`; e-mail interno |
| … Cliente problema não resolvido (Concluído → Em andamento - tag não resolvido) | … `[NAO_RESOLVIDO]` | Em andamento; tag `nao-resolvido`; e-mail interno |
| … Não autorizado (tag) | Modo especialista: Estado **foi alterado** + Estado é Não autorizado | tag `nao-autorizado` |
| … Cliente reenvia (Não autorizado → Reavaliação - tag reenviado) | Tags contém `nao-autorizado`; Remetente é Cliente; Assunto contém `[REENVIAR]` | Reavaliação; remove `nao-autorizado`; adiciona `reenviado`; e-mail interno (opcional) |
| … Administrador atribui agente (Autorizado → Em andamento) | Estado é Autorizado + Responsável definido | Em andamento; e-mail ao cliente "Seu chamado #… está em andamento" |
| Notificação - Chamado autorizado / concluído / em análise / não autorizado (avisa o cliente) | Modo especialista: Estado foi alterado + Estado é X (Não autorizado também exige **artigo público**) | e-mail público ao cliente (Não autorizado leva `Motivo: #{article.body_as_text}`) |
| Sincronizar Prioridade - Baixa / Alta / Urgente | Na **criação**: Prioridade sugerida é X | Prioridade → X ("Normal" desligado: já é o padrão) |
| auto reply (on new tickets) | padrão | ativo |

- A condição por **tag** no reenvio é de propósito: resposta de cliente em ticket fechado pode reabrir sozinho.
- Não existe "foi alterado para" nem condição repetida no modo normal: use o **Modo especialista** (E).
- Modelo de e-mail interno: assunto `[REJEITADO] #{ticket.title}`; corpo
  `#{ticket.customer.fullname} … #{ticket.number} - #{ticket.title}\n\nMotivo: #{article.body_as_text}\n\n#{config.http_type}://#{config.fqdn}/#ticket/zoom/#{ticket.id}`;
  visibilidade **interna**. Links do portal nos e-mails: ainda em branco.

### 1.7 Agendador

"Finalizar chamados concluídos após 48h": Estado é Concluído (com 48 h sem atualização) → Finalizado.

### 1.8 Visões gerais

`<Setor> - Todos os chamados` (administrador) e `<Setor> - Meus chamados` (agente: Responsável = usuário
atual, Estado Em andamento/Concluído).

---

## 2. Contrato plugin → Zammad

| Quem | Ação no portal | O que o plugin envia |
|---|---|---|
| Cliente | Aprovar / Pedir ajustes / Problema não resolvido / Rejeitar entrega (só em Concluído) | `POST /ticket_articles` com `subject` = `[APROVADO]` / `[AJUSTAR]` / `[NAO_RESOLVIDO]` / `[REJEITADO]`, `body` = motivo (obrigatório exceto aprovar), `type: "web"`, `sender: "Customer"`, `internal: false`, `X-On-Behalf-Of: <cliente>` |
| Cliente | Reenviar para análise (só em Não autorizado) | idem com `[REENVIAR]` (motivo obrigatório) |
| Cliente | mensagem comum | só fora de Concluído/Não autorizado/Finalizado |
| Gestor | Iniciar análise / Autorizar / Não autorizar | `PUT /tickets/:id` com `state_id`; em "Não autorizar" também `article` = nota **pública** com o motivo (o gatilho de aviso lê `#{article.body_as_text}`) |
| Gestor | Atribuir responsável (em Autorizado) | `PUT owner_id` → o gatilho leva a Em andamento |
| Agente (responsável) | Concluir (texto opcional) / Voltar para em andamento | `PUT state_id` (+ nota pública se houver texto) |

**O cliente NUNCA manda `state_id`.** O Zammad não protege o estado no servidor; a regra "cliente não muda
estado" só se sustenta se ninguém mandar. Pelo mesmo motivo o plugin valida as transições da equipe
(`canMoveTo`) antes do PUT.

---

## 3. O que o plugin faz (v1.2.0)

### 3.1 Fluxo (`shared/flow.ts`, testado em `flow.test.ts`)
Estados por nome → `FlowStep`; cores semânticas; ações do cliente (palavras); transições da equipe
(gestor: Novo/Em análise/Autorizado/Reavaliação → Em análise, Autorizado, Não autorizado, Reavaliação;
responsável: Em andamento ↔ Concluído); dicas por passo. Fora desses estados, o plugin segue o
comportamento genérico antigo (encerrar/reabrir), para outros Zammads.

### 3.2 Telas
- **Solicitante**: linha do tempo das etapas no cabeçalho; em Concluído/Não autorizado um **painel de
  decisão** destacado com botões cheios na cor semântica (aprovar = sucesso, ajustes/não resolvido =
  alerta, rejeitar = perigo, reenviar = primária), sempre com confirmação e campo de motivo; caixa de
  resposta some nesses passos (e em Finalizado aparece "Novo chamado").
- **Equipe (app)**: "Próximo passo" com os botões do fluxo; dica do passo; seletor de estado só com os
  destinos permitidos; prioridade continua no seletor.
- **Fila do gestor (v1.2.0)**: abas por etapa — Novo, Em análise, Reavaliação, Autorizado, Não autorizado e
  Atribuídos (abertos dos agentes da equipe) — com filtro de setor secundário (`?etapa=&setor=&ordem=`).
  Card de **Novo**: "Analisar" abre um diálogo com o resumo do pedido (respostas, texto, anexos) e as decisões
  Manter em análise / Autorizar / Não autorizar (motivo obrigatório) / **Autorizar e atribuir** (um só PUT com
  `state_id` = Autorizado + `owner_id`; o gatilho "Administrador atribui agente" leva a Em andamento). Card de
  **Em análise / Reavaliação**: Continuar análise, Autorizar, Não autorizar e Autorizar e atribuir. Card de
  **Autorizado**: escolher agente + Atribuir. O número no menu "Fila" = decisões pendentes (Novo + Em análise +
  Reavaliação + Autorizado).
- Layout de **uma coluna** em todo o plugin (sem grades de 2 colunas de conteúdo) e moldura alinhada à
  esquerda, junto do breadcrumb do portal.
- Cores: só tokens do tema (`success`, `warning`, `destructive`, `primary`, `chart-2`, `muted`) — tabela
  `FLOW_BADGE` em `routes/public/palette.ts`. Desde a v1.4.0 segue a regra de design do core
  (`.claude/rules/ui-design.md`): a cor do estado fica só na bolinha do selo; fundo colorido só para o que pede
  ação ("Aguardando você", urgente, atrasado, nota interna). O editor de temas do core expõe sucesso e perigo
  (além de alerta) na paleta personalizada.

### 3.3 Audiência dos setores vinda do Zammad
`allowedGroupIds` (`shared/workflow.ts`) avalia os Core Workflows da máscara de criação que mexem em
`ticket.group_id` (remove/add/fixar opção), com as funções da pessoa. `groupsAllowedByZammad`
(`shared/form.ts`) expande pela árvore: liberar o setor libera as subcategorias; liberar só a subcategoria
mostra o pai para navegar. Soma-se aos grupos de pessoas do plugin (os dois filtros valem). Admin do
Colabora continua vendo tudo (prévia). Testado em `group-audience.test.ts`.

### 3.4 Papéis
Gestor = papel com `report` **ou** nome `<Setor> - Administrador` (`SECTOR_MANAGER_ROLE`). Gestor que abriu
chamado em grupo que ele não "possui" (full/change) vê o chamado como solicitante (`supervisesGroup`).

---

## 4. Pendências

- **Nenhuma escrita foi testada contra o Zammad real** pelo portal. Primeiro teste sugerido: com um
  chamado de teste em Concluído, clicar "Aprovar" e conferir o gatilho no histórico.
- Testar se o Zammad aceita artigo de cliente em ticket **fechado** (Não autorizado) via API; se recusar,
  o reenvio precisa de outro caminho (token técnico ajustando o estado).
- Conferir que os fluxos 700–730 não mexem em Estado/Responsável.
- Aviso aos administradores em chamado novo e em rejeição; links do portal nos e-mails.
- Filtro no servidor para agente ver só Em andamento/Concluído (hoje ele já só vê os atribuídos a ele).
- Subgrupos de Tecnologia; renumerar um dos fluxos 606.
- Revogar o token pessoal que foi colado no chat; produção com token de usuário técnico.
