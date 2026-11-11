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

export type FormAnswer = { label: string; value: string };

function plain(fragment: string): string {
  return decodeEntities(fragment.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "")).trim();
}

// O 1º artigo de um chamado aberto pelo portal termina com um resumo das respostas do formulário
// (`composeBody` em answers.ts): <hr><p><strong>Respostas do formulário</strong></p><ul><li><strong>
// pergunta</strong>: resposta</li>…</ul><p><em>Aberto pelo …</em></p>. Aqui esse bloco é separado do
// texto para a tela mostrar como lista (pergunta/resposta) em vez de texto corrido.
export function extractFormAnswers(html: string): { html: string; answers: FormAnswer[] } {
  const block = /<hr\s*\/?>\s*<p>\s*<strong>\s*Respostas do formulário\s*<\/strong>\s*<\/p>\s*<ul>([\s\S]*?)<\/ul>(\s*<p>\s*<em>[\s\S]*?<\/em>\s*<\/p>)?/i.exec(html);
  if (!block) return { html, answers: [] };
  const answers: FormAnswer[] = [];
  for (const item of block[1].matchAll(/<li>\s*<strong>([\s\S]*?)<\/strong>\s*:\s*([\s\S]*?)<\/li>/gi)) {
    const label = plain(item[1]);
    if (label) answers.push({ label, value: plain(item[2]) || "—" });
  }
  return { html: html.replace(block[0], ""), answers };
}

export type ReplyQuote = { author: string; excerpt: string };

// Trecho curto de uma mensagem para citar ("Responder", como no WhatsApp): uma linha, sem quebras.
export function makeExcerpt(text: string, max = 220): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

// Mensagem que responde a outra começa com <blockquote><p><strong>autor</strong></p><p>trecho</p>
// </blockquote> (`composeReplyBody` em answers.ts). O Zammad mostra isso como citação normal para a
// equipe; o portal tira o bloco do texto e o exibe como cartão de resposta. Só vale no INÍCIO do corpo:
// citação de e-mail (no fim) continua sendo descartada por htmlToText.
export function extractReplyQuote(html: string): { html: string; quote: ReplyQuote | null } {
  const match = /^\s*<blockquote\b[^>]*>\s*<p\b[^>]*>\s*<strong\b[^>]*>([\s\S]*?)<\/strong>\s*<\/p>\s*<p\b[^>]*>([\s\S]*?)<\/p>\s*<\/blockquote>/i.exec(html);
  if (!match) return { html, quote: null };
  const author = plain(match[1]);
  const excerpt = plain(match[2]);
  if (!author || !excerpt) return { html, quote: null };
  return { html: html.slice(match[0].length), quote: { author, excerpt } };
}

// Texto "de conversa" de um artigo: sem resumo do formulário nem bloco de citação.
export function articleVisibleText(body: string, contentType: string): string {
  if (!contentType.toLowerCase().includes("html")) return articleToText(body, contentType);
  return articleToText(extractFormAnswers(extractReplyQuote(body).html).html, contentType);
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
