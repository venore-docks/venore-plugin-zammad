// "Próximos passos" da visão geral do admin: o que falta ou está estranho, em ordem de importância.
// Puro e testado (admin-hints.test.ts); a tela só mostra.

export const ADMIN_BASE = "/admin/colabora";

export type AdminHint = {
  id: string;
  tone: "destructive" | "warning" | "info";
  title: string;
  description: string;
  href: string | null;
};

export type HintInput = {
  connection: { configured: false } | { configured: true; error: string | null };
  sectors: { groupId: number; name: string; enabled: boolean; fieldCount: number; audienceKind: "all" | "groups" | "hidden" }[];
  peopleGroups: { id: string; name: string; memberCount: number; sectorCount: number }[];
  appName: string | null;
  unsupportedCount: number;
};

export const MAX_HINTS = 6;

export function buildHints(input: HintInput): AdminHint[] {
  const hints: AdminHint[] = [];

  if (!input.connection.configured) {
    hints.push({
      id: "no-connection",
      tone: "destructive",
      title: "Zammad não configurado",
      description: "Defina ZAMMAD_URL e ZAMMAD_API_TOKEN nas variáveis do projeto e faça um novo deploy.",
      href: null,
    });
    return hints;
  }
  if (input.connection.error) {
    hints.push({
      id: "connection-error",
      tone: "destructive",
      title: "O Colabora não está conseguindo falar com o Zammad",
      description: input.connection.error,
      href: ADMIN_BASE,
    });
  }

  const active = input.sectors.filter((sector) => sector.enabled);
  for (const sector of active.filter((entry) => entry.audienceKind === "hidden")) {
    hints.push({
      id: `sector-hidden-${sector.groupId}`,
      tone: "warning",
      title: `O setor ${sector.name} não aparece para ninguém`,
      description: "Ele está restrito a grupos de pessoas, mas nenhum grupo foi liberado. Só administradores o enxergam.",
      href: `${ADMIN_BASE}/setores/${sector.groupId}`,
    });
  }
  for (const sector of active.filter((entry) => entry.fieldCount === 0)) {
    hints.push({
      id: `sector-empty-${sector.groupId}`,
      tone: "info",
      title: `O setor ${sector.name} está sem perguntas`,
      description: "A pessoa só preenche título e descrição. Se não for isso que você quer, crie os campos no Zammad.",
      href: `${ADMIN_BASE}/setores/${sector.groupId}`,
    });
  }

  if (input.peopleGroups.length === 0) {
    hints.push({
      id: "no-people-groups",
      tone: "info",
      title: "Nenhum grupo de pessoas criado",
      description: "Crie um grupo por setor (ex.: TI, RH) para liberar só os fluxos que fazem sentido para cada grupo.",
      href: `${ADMIN_BASE}/grupos`,
    });
  } else {
    for (const group of input.peopleGroups.filter((entry) => entry.memberCount === 0)) {
      hints.push({
        id: `group-empty-${group.id}`,
        tone: "info",
        title: `O grupo ${group.name} não tem ninguém`,
        description: "Adicione pessoas por busca ou colando uma lista de e-mails.",
        href: `${ADMIN_BASE}/grupos/${group.id}`,
      });
    }
    for (const group of input.peopleGroups.filter((entry) => entry.memberCount > 0 && entry.sectorCount === 0)) {
      hints.push({
        id: `group-unused-${group.id}`,
        tone: "info",
        title: `O grupo ${group.name} ainda não libera nenhum setor`,
        description: "Escolha em “Setores liberados” quais fluxos esse grupo pode abrir.",
        href: `${ADMIN_BASE}/grupos/${group.id}`,
      });
    }
  }

  if (!input.appName) {
    hints.push({
      id: "no-app-name",
      tone: "info",
      title: "O app ainda não tem um nome",
      description: "Sem nome, o ícone do celular usa “Chamados · nome do site”.",
      href: `${ADMIN_BASE}/app`,
    });
  }
  if (input.unsupportedCount > 0) {
    hints.push({
      id: "unsupported-rules",
      tone: "warning",
      title: `${input.unsupportedCount} ${input.unsupportedCount === 1 ? "regra do Zammad" : "regras do Zammad"} que o portal não sabe aplicar`,
      description: "O formulário pode divergir do Zammad nesses pontos. Simplifique a regra lá.",
      href: ADMIN_BASE,
    });
  }

  const order = { destructive: 0, warning: 1, info: 2 } as const;
  return hints.sort((a, b) => order[a.tone] - order[b.tone]);
}
