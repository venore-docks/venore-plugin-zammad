import { isSupervisor } from "../../shared/access-rules";
import { staffRoleFor } from "../../shared/directory";
import { resolveRequester } from "../../shared/requester";
import { failure } from "../../shared/results";
import { getManagerDashboard, getQueueBoard, getTeamLoads } from "./service";
import type { GetManagerDashboardResult, GetQueueBoardResult, GetTeamLoadsResult } from "./types";

// Tudo aqui é do gestor/admin: o agente comum não vê fila nem carga da equipe (a autorização fica no handler).
export async function getManagerDashboardHandler(): Promise<GetManagerDashboardResult> {
  const requester = await resolveRequester();
  if (!requester.success) return requester;
  if (!isSupervisor(await staffRoleFor(requester.data))) return failure("forbidden_team", "Só o gestor vê a gestão da equipe.");
  return getManagerDashboard(requester.data);
}

export async function getQueueBoardHandler(): Promise<GetQueueBoardResult> {
  const requester = await resolveRequester();
  if (!requester.success) return requester;
  if (!isSupervisor(await staffRoleFor(requester.data))) return failure("forbidden_queue", "A fila de chamados sem responsável é do gestor.");
  return getQueueBoard(requester.data);
}

export async function getTeamLoadsHandler(): Promise<GetTeamLoadsResult> {
  const requester = await resolveRequester();
  if (!requester.success) return requester;
  if (!isSupervisor(await staffRoleFor(requester.data))) return failure("forbidden_team", "Só o gestor vê a carga da equipe.");
  return getTeamLoads(requester.data);
}
