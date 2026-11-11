// Quem pode ver/mexer em um chamado — regra pura (sem Zammad), testada em access-rules.test.ts.
//
// No Zammad o "sem responsável" é o usuário id 1 (system). Papéis:
//   - solicitante (customer_id = a pessoa): vê a conversa, responde, cita. Em chamado alheio → nada.
//   - agente (papel com ticket.agent/admin): no app, vê e trabalha chamados ATRIBUÍDOS a ele e vê os
//     SEM RESPONSÁVEL (fila) para poder assumir. Chamado atribuído a OUTRO agente não aparece aqui:
//     quem quiser ver usa o Zammad. O Zammad já limita o que cada agente enxerga aos seus grupos.
export const UNASSIGNED_OWNER_ID = 1;

export type ViewerMode = "customer" | "agent";

export type AccessInput = {
  customerId: number;
  ownerId: number | null | undefined;
  meId: number;
  isAgent: boolean;
  // A superfície pede visão de agente (o app); o portal comum nunca pede.
  asAgent: boolean;
};

export function isUnassigned(ownerId: number | null | undefined): boolean {
  return !ownerId || ownerId === UNASSIGNED_OWNER_ID;
}

export function viewerMode(input: AccessInput): ViewerMode | null {
  // Visão de agente tem precedência: um agente que também é o solicitante (teste, chamado próprio)
  // precisa dos controles de agente quando o chamado está com ele.
  if (input.asAgent && input.isAgent && (input.ownerId === input.meId || isUnassigned(input.ownerId))) return "agent";
  if (input.customerId === input.meId) return "customer";
  return null;
}

// Trabalhar o chamado (responder como agente, nota interna, estado, prioridade, devolver) exige que ele
// esteja COM a pessoa. Fila: só dá para assumir.
export function canWorkTicket(mode: ViewerMode | null, ownerId: number | null | undefined, meId: number): boolean {
  return mode === "agent" && ownerId === meId;
}
