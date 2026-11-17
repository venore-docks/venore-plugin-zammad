import type { OperationResult } from "@venore/plugin-sdk";
import type { CustomerActionKey } from "../../contracts/types";

// Decisão do SOLICITANTE num chamado do fluxo da FEM (Concluído: aprovar/ajustes/não resolvido/rejeitar;
// Não autorizado: reenviar). Vira um artigo público dele com a palavra de controle no ASSUNTO — quem muda
// o estado são os gatilhos do Zammad. `reason` é obrigatório em todas, exceto aprovar.
export type CustomerRespondInput = { ticketId: number; action: CustomerActionKey; reason?: string | null };
export type CustomerRespondResult = OperationResult<{ action: CustomerActionKey; message: string }>;
