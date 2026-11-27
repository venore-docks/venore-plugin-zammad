// Ajuda da etapa "Pedido" (título e descrição), por setor/assunto. O texto antigo era de hardware ("Projetor da sala
// 204 não liga", "sala, prédio, equipamento") e aparecia em todo setor. Puro: testado em hints.test.ts.
// O texto configurado no admin (`bodyHint` do setor) continua valendo por cima destas linhas.

export type BodyGuidance = { example: string; lines: string[] };

const GENERIC: BodyGuidance = {
  example: "Atualizar o meu cadastro no sistema",
  lines: ["O que você precisa ou o que aconteceu?", "Em que assunto ou lugar? (setor, sala, sistema)", "Desde quando, ou para quando precisa?", "Já tentou alguma coisa? Qual foi o resultado?"],
};

// Chave = trecho do nome do setor (sem acento e em minúsculas). O mais específico (subgrupo) vale primeiro.
const BY_SECTOR: { key: string; guidance: BodyGuidance }[] = [
  {
    key: "acesso a sistemas",
    guidance: {
      example: "Criar conta para Maria Souza no Prime",
      lines: ["Qual sistema e que tipo de acesso (criar, liberar, trocar senha, remover)?", "Para quem é? (nome completo e e-mail institucional)", "A partir de quando a pessoa precisa do acesso?", "Quem aprovou, se for um acesso restrito?"],
    },
  },
  {
    key: "desenvolvimento",
    guidance: {
      example: "O calendário do Portal não mostra o recesso de julho",
      lines: ["O que precisa ser feito, ou o que está errado?", "Em qual sistema e em qual tela?", "Como repetir o problema, se for um erro?", "Para quando precisa?"],
    },
  },
  {
    key: "infraestrutura",
    guidance: {
      example: "Wi-Fi do bloco B cai toda hora",
      lines: ["O que está acontecendo? (rede, internet, servidor, telefone)", "Onde acontece e quantas pessoas são afetadas?", "Desde quando?", "O que já tentou? Qual foi o resultado?"],
    },
  },
  {
    key: "suporte",
    guidance: {
      example: "Projetor da sala 204 não liga",
      lines: ["O que você precisa ou o que aconteceu?", "Onde? (sala, prédio, equipamento)", "Desde quando, ou para quando precisa?", "Já tentou alguma coisa? Qual foi o resultado?"],
    },
  },
  {
    key: "marketing",
    guidance: {
      example: "Arte para o convite do Dia da Família",
      lines: ["O que precisa ser criado ou divulgado?", "Para qual evento ou ação, e quem é o público?", "Para quando precisa estar pronto?", "Tem referência, texto ou imagem de apoio?"],
    },
  },
  {
    key: "manutencao",
    guidance: {
      example: "Torneira do banheiro do bloco A vaza",
      lines: ["O que precisa de conserto ou instalação?", "Onde? (prédio, sala, andar)", "Desde quando? Existe risco para alguém?", "Para quando precisa?"],
    },
  },
  {
    key: "recursos humanos",
    guidance: {
      example: "Atualizar o endereço no meu cadastro",
      lines: ["Qual é o assunto?", "Que informação ou documento está envolvido?", "Desde quando, ou para quando precisa?", "Já falou com alguém do setor? Quem?"],
    },
  },
];

function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// `names`: do mais específico ao mais geral (ex.: ["Acesso a sistemas", "Tecnologia"]).
export function bodyGuidanceFor(names: readonly string[]): BodyGuidance {
  for (const name of names) {
    const folded = fold(name);
    const hit = BY_SECTOR.find((entry) => folded.includes(entry.key));
    if (hit) return hit.guidance;
  }
  return GENERIC;
}
