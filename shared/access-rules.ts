// Quem pode ver/mexer em um chamado — regra pura (sem Zammad), testada em access-rules.test.ts.
//
// Papéis (derivados dos papéis do Zammad, ver staffRoleOf):
//   customer  colaborador comum: só o que ele abriu.
//   agent     atende: vê e trabalha SÓ os chamados atribuídos a ele. Não vê a fila nem aloca.
//   manager   gestor de equipe (papel com `report`): vê a fila e a equipe dos seus grupos, aloca/realoca
//             chamados entre os agentes, acompanha estado e prioridade. Só RESPONDE o que está com ele.
//   admin     como o gestor, sobre o que a conta admin enxerga no Zammad.
// No Zammad o "sem responsável" é o usuário id 1 (system). O Zammad já limita o que cada pessoa enxerga
// aos grupos dela; aqui é a regra a mais da superfície.
export const UNASSIGNED_OWNER_ID = 1;

export type StaffRole = "customer" | "agent" | "manager" | "admin";
export type ViewerMode = "customer" | "agent";

export function isStaff(role: StaffRole): boolean {
  return role !== "customer";
}

// Gestor e admin: veem a fila, a equipe e alocam chamados.
export function isSupervisor(role: StaffRole): boolean {
  return role === "manager" || role === "admin";
}

export function isUnassigned(ownerId: number | null | undefined): boolean {
  return !ownerId || ownerId === UNASSIGNED_OWNER_ID;
}

// Papel de quem tem os papéis do Zammad com estas permissões (uma lista por papel). Admin vence gestor,
// que vence agente. Sem `ticket.agent`/`admin` em nenhum papel = colaborador comum.
export function staffRoleOf(rolePermissions: string[][]): StaffRole {
  const all = new Set(rolePermissions.flat());
  if (all.has("admin")) return "admin";
  if (!all.has("ticket.agent")) return "customer";
  return all.has("report") ? "manager" : "agent";
}

export type AccessInput = {
  customerId: number;
  ownerId: number | null | undefined;
  meId: number;
  role: StaffRole;
  // A superfície pede visão de agente (o app); o portal comum nunca pede.
  asAgent: boolean;
};

export function viewerMode(input: AccessInput): ViewerMode | null {
  if (input.asAgent && isStaff(input.role)) {
    // Supervisor vê o que o Zammad deixar; agente, só o que está com ele (a fila não é dele).
    if (isSupervisor(input.role) || input.ownerId === input.meId) return "agent";
  }
  if (input.customerId === input.meId) return "customer";
  return null;
}

// Responder (ao solicitante ou nota) exige o chamado COM a pessoa.
export function canWorkTicket(mode: ViewerMode | null, ownerId: number | null | undefined, meId: number): boolean {
  return mode === "agent" && ownerId === meId;
}

// Alocar = atribuir a um agente, realocar, devolver à fila: só gestor/admin.
export function canAllocate(mode: ViewerMode | null, role: StaffRole): boolean {
  return mode === "agent" && isSupervisor(role);
}

// Estado e prioridade: quem trabalha o chamado ou quem o supervisiona.
export function canEditTicket(mode: ViewerMode | null, role: StaffRole, ownerId: number | null | undefined, meId: number): boolean {
  return canWorkTicket(mode, ownerId, meId) || canAllocate(mode, role);
}

export function canSeeQueue(role: StaffRole): boolean {
  return isSupervisor(role);
}
