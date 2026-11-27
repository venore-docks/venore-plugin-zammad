# Colabora v2: pausa, prazos, timers, metas, webhook e Planner — plano

Status: **aprovado em 27/11/2026**. Substitui `plano-prazos-por-etapa.md` (26/11). Cada etapa sai numa versão com
testes, CHANGELOG e (quando houver) migration.

## Decisões

| # | Pergunta | Decisão |
|---|---|---|
| 1 | Canal dos avisos (metas, risco de prazo) | **Selo no menu do portal** (`notificationAlert`), **push no app** (`sendPushToActor`) e **e-mail pelo Zammad** (o plugin grava a marca no chamado; um gatilho do Zammad envia) |
| 2 | Prioridade sugerida | A chave é `prioridade_cliente` (rótulo "Prioridade sugerida"); obrigatória para o cliente na criação: o assistente pergunta (v1.11.0) |
| 3 | Plano de 26/11 | Substituído: pausa só pelo estado **Em pausa (11)** com `motivo_pausa`; sem tag `analisado`; meta de Novo = sair de Novo |
| 4 | "1d", "1sem" em horas úteis | **Dia útil do calendário** do Zammad ("Horário comercial FEM"): 1d = a jornada de um dia útil; 1sem = 5 dias úteis |
| 5 | Quem pausa/retoma | **O responsável e o gestor**. Um agente tem **um** chamado Em andamento por vez: iniciar outro pausa o atual (motivo `urgencia`, nota do plugin "interrompido por #N") |
| 6 | Administrador não preencheu tempo/prazo ao atribuir ou iniciar | O plugin preenche **1 dia útil**: `tempo_previsto = 1d` e `prazo_entrega` = agora + 1 dia útil pelo calendário |
| 7 | Acesso de leitura ao Zammad para os testes | Feito: recorte real em `shared/__fixtures__/fem-schema-live.json` |
| 8 | Cron no Coolify | O responsável configura `CRON_SECRET` e uma tarefa agendada chamando `/api/cron/tick` a cada 5 min |
| 9 | Planner | Plugin próprio, `venore-docks/venore-plugin-planner` (MIT), com dependência opcional do Colabora |

## Etapas

| # | Etapa | Versão |
|---|---|---|
| 0 | Fundação: escrita exige `X-On-Behalf-Of`; script de exportação do recorte | v1.11.0 |
| 1 | Campos condicionais por valor (Core Workflows completos) | v1.11.0 |
| 2 | Em pausa (Pausar/Retomar), campos obrigatórios da transição pelo avaliador na tela `edit`, prazo e tempo previsto no detalhe e na fila, padrão de 1 dia útil, um Em andamento por agente | v1.12.0 |
| 3 | Banco do plugin (schema `colabora`): eventos, intervalos, notas do plugin | v1.13.0 |
| 4 | Horas úteis pelo calendário do Zammad (Calendários como fonte opcional de feriados) | |
| 5 | Webhook `/api/colabora/webhook/zammad` (HMAC, `COLABORA_WEBHOOK_SECRET`) e conferência pelo histórico | |
| 6 | Relógios: esforço, prazo, risco, contador regressivo, idade útil e corrida | |
| 7 | Metas e avisos (aba "Metas" no admin) | |
| 8 | Pai com filhos: pausar e retomar o pai (configuração, desligada) | |
| 9 | Conta de serviço no Zammad (lista do que é preciso) | |
| 10 | Planner (plugin próprio) | |

## Pendências externas

- Transição de Atribuído (10) para Em andamento (8) para agentes: a definir no Zammad.
- Manutenção, Marketing e RH: serão parametrizados no Zammad (o plugin lê tudo dinamicamente).
- Webhook no Zammad: cadastrar quando a etapa 5 sair, com o endereço acima.
