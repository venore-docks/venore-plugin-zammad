# Prompt — configurar no Zammad o e-mail de alerta de prazo

Para colar num agente com acesso ao navegador (logado como administrador no Zammad da FEM). Os nomes abaixo
(assunto `[PRAZO_ATRASADO]`, tags `prazo-*`) são o contrato com o Colabora: não mude sem mudar o plugin.

---

Você vai configurar o Zammad da FEM (https://colabora.fem.edu.br, versão 7.2) para enviar **e-mail de alerta
quando um chamado passa do prazo**. Quem detecta o atraso é o portal Colabora, não o Zammad: quando um prazo
estoura, o Colabora grava no chamado uma **nota interna** cujo **assunto** é um destes:

- `[PRAZO_ATRASADO] Novo` — ninguém analisou o chamado no prazo. Avisar os **gestores do setor**.
- `[PRAZO_ATRASADO] Atribuído` — o responsável não iniciou o atendimento no prazo. Avisar os **gestores do setor**
  e o **responsável**.
- `[PRAZO_ATRASADO] Em andamento` — passou do tempo previsto. Avisar os **gestores do setor** e o **responsável**.

O Colabora também põe no chamado a tag `prazo-novo`, `prazo-atribuido` ou `prazo-andamento`. Você não precisa
usar as tags; elas só evitam alerta repetido.

"Gestores do setor" são os usuários da função `<Setor> - Administrador` (Manutenção, Marketing, Recursos Humanos,
Tecnologia).

## O que fazer

1. Em **Administração → Gatilho**, abra a tela de criar gatilho e confira quais destinatários a ação
   **Notificação → E-mail** oferece (ex.: Cliente, Responsável, Agente atual, Todos os agentes, usuários
   específicos, funções). Anote a lista.
2. Crie os gatilhos de alerta. Para cada um:
   - **Ativado quando**: ação — chamado atualizado (é a nota interna que dispara).
   - **Condições**: `Artigo > Assunto` **contém** `[PRAZO_ATRASADO] Novo` (ou `Atribuído`, ou `Em andamento`)
     **E** `Artigo > Visibilidade` = interno. Se o gatilho for por setor, também `Ticket > Grupo` é o grupo do setor
     (e os subgrupos dele).
   - **Ação**: Notificação → E-mail.
     - **Destinatários**: os gestores do setor. Se o Zammad não deixa escolher uma função como destinatário, crie
       **um gatilho por setor** com a condição de Grupo e escolha os gestores daquele setor como usuários
       específicos. Nos alertas de Atribuído e Em andamento, inclua também o **Responsável**.
     - **Assunto**: `Prazo estourado: #{ticket.title} (##{ticket.number})`
     - **Corpo**: diga a etapa, o setor (`#{ticket.group.name}`), o responsável (`#{ticket.owner.fullname}`) e o
       texto da nota (`#{article.body_as_text}`). **Não inclua link para o Zammad** (a equipe usa o portal).
   - Nome sugerido: `Alerta de prazo - <Etapa>` (ou `Alerta de prazo - <Etapa> - <Setor>`).
3. **Não altere** nenhum outro gatilho, fluxo de trabalho, estado ou função. Não crie nem copie tokens de API.
4. Confira que nenhum gatilho existente manda e-mail ao **cliente** para notas internas. Uma nota interna não deve
   avisar o solicitante. Se algum fizer isso, **não mude**: só me conte qual é.

## Teste

Num chamado **de teste** (crie um, se não houver), adicione uma nota **interna** com o assunto
`[PRAZO_ATRASADO] Novo` e veja no histórico do chamado se o e-mail saiu para as pessoas certas. Depois apague o
chamado de teste ou mova-o para Finalizado.

## O que me devolver

- A lista de destinatários disponível (passo 1).
- O nome e as condições de cada gatilho criado, e quem recebe cada um.
- O resultado do teste (quem recebeu o e-mail).
- Qualquer gatilho existente que avise o cliente em nota interna (passo 4).
