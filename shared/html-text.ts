// HTML dos artigos do Zammad (e-mails da equipe, notas) → texto simples.
//
// Por que não renderizar o HTML: ele vem de e-mails de terceiros e do editor do agente — scripts,
// estilos, imagens com URL relativa do Zammad, "rastreadores". O portal mostra só o texto (as imagens
// anexadas aparecem como anexos). O texto é renderizado pelo React, que escapa tudo.

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  laquo: "«",
  raquo: "»",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#")) {
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

// Remove citações ("Em ... escreveu:") — o histórico já aparece nas mensagens anteriores da conversa.
function stripBlockquotes(html: string): string {
  const innermost = /<blockquote\b[^>]*>(?:(?!<blockquote\b)[\s\S])*?<\/blockquote>/gi;
  let previous = "";
  let current = html;
  while (current !== previous) {
    previous = current;
    current = current.replace(innermost, "");
  }
  return current;
}

export function htmlToText(html: string): string {
  let text = html.replace(/\r\n?/g, "\n");
  text = text.replace(/<(script|style|head)\b[\s\S]*?<\/\1>/gi, "");
  text = stripBlockquotes(text);
  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<hr\s*\/?>/gi, "\n———\n")
    .replace(/<(ul|ol)\b[^>]*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/(div|h[1-6]|tr|table|ul|ol|li)>/gi, "\n")
    .replace(/<[^>]*>/g, "");
  text = decodeEntities(text);
  return normalizeText(text);
}

export function normalizeText(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t ]+$/g, "").replace(/^[ \t]+(?=\S)/, (indent) => (indent.length > 8 ? "" : indent)))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function articleToText(body: string, contentType: string): string {
  return contentType.toLowerCase().includes("html") ? htmlToText(body) : normalizeText(body.replace(/\r\n?/g, "\n"));
}

// Remetente de e-mail do Zammad: "Felipe Cardoso via Zammad Helpdesk Support <suporte@…>" → "Felipe Cardoso".
export function cleanSenderName(from: string | null | undefined): string {
  if (!from || from.trim() === "-") return "";
  return from
    .replace(/<[^>]*>/g, "")
    .replace(/\s+via\s+.+$/i, "")
    .replace(/^"|"$/g, "")
    .trim();
}
