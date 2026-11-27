// "O solicitante respondeu", pela conversa do chamado (a tela do chamado tem os artigos). Puro: testado.
// Conta só mensagem do solicitante POSTERIOR à última resposta PÚBLICA da equipe, ignorando a mensagem de abertura.
// Não conta se quem abriu é o próprio responsável, nem em Aguardando solicitante (a equipe é quem espera).

export type ReplyMessage = { role: "me" | "team" | "customer" | "system"; internal: boolean };

export function requesterRepliedAfterAgent(messages: readonly ReplyMessage[], options: { awaitingRequester: boolean; ownerIsRequester: boolean }): boolean {
  if (options.awaitingRequester || options.ownerIsRequester) return false;
  const visible = messages.filter((message) => message.role !== "system");
  const lastAgent = visible.reduce((found, message, index) => ((message.role === "me" || message.role === "team") && !message.internal ? index : found), -1);
  // Índice 0 é a abertura do chamado (do próprio solicitante): nunca vale como resposta.
  return visible.some((message, index) => index > 0 && index > lastAgent && message.role === "customer");
}
