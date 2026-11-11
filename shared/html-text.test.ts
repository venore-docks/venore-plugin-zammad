import { describe, expect, it } from "vitest";
import { composeReplyBody } from "./answers";
import { articleToText, cleanSenderName, extractFormAnswers, extractReplyQuote, htmlToText, makeExcerpt } from "./html-text";

describe("htmlToText", () => {
  it("e-mail real da equipe: divs e br viram linhas", () => {
    expect(htmlToText("Olá Adoniran,<div><br></div><div>Nesta semana foi realocado o access point.</div>")).toBe(
      "Olá Adoniran,\n\nNesta semana foi realocado o access point.",
    );
  });

  it("descarta script, style e citações aninhadas", () => {
    const html = '<p>Resposta</p><style>p{color:red}</style><script>alert(1)</script><blockquote>velho<blockquote>mais velho</blockquote>ainda velho</blockquote><p>Fim</p>';
    expect(htmlToText(html)).toBe("Resposta\n\nFim");
  });

  it("lista, hr e entidades (nomeadas, decimais, hex); tags em texto não viram HTML", () => {
    expect(htmlToText("<ul><li>um &amp; dois</li><li>tr&ecirc;s &#233; &#xE9;</li></ul><hr>fim")).toBe("• um & dois\n• tr&ecirc;s é é\n\n———\nfim");
    expect(htmlToText("&lt;script&gt;alert(1)&lt;/script&gt;")).toBe("<script>alert(1)</script>");
  });

  it("corpo que o próprio portal envia (descrição + resumo das respostas)", () => {
    const html = "<p>Preciso de um banner</p><hr><p><strong>Respostas do formulário</strong></p><ul><li><strong>Materiais</strong>: banner</li></ul><p><em>Aberto pelo Portal.</em></p>";
    expect(htmlToText(html)).toBe("Preciso de um banner\n\n———\nRespostas do formulário\n\n• Materiais: banner\n\nAberto pelo Portal.");
  });

  it("texto puro mantém quebras e não decodifica entidades", () => {
    expect(articleToText("a &amp; b\r\n\r\n\r\n\r\nc", "text/plain")).toBe("a &amp; b\n\nc");
    expect(articleToText("<b>a</b>", "text/html")).toBe("a");
  });
});

describe("extractFormAnswers", () => {
  const html =
    "<p>Quero algo WOW!</p><hr><p><strong>Respostas do formulário</strong></p><ul>" +
    "<li><strong>Prioridade inicial</strong>: Normal</li>" +
    "<li><strong>Quem é o público alvo?</strong>: alunos, pais</li>" +
    "<li><strong>Orientação (cores &amp; tamanho)?</strong>: Faz o que Jesus tocar</li></ul>" +
    "<p><em>Aberto pelo Colaborador FEM.</em></p>";

  it("separa o resumo do texto e devolve pergunta/resposta", () => {
    const result = extractFormAnswers(html);
    expect(result.answers).toEqual([
      { label: "Prioridade inicial", value: "Normal" },
      { label: "Quem é o público alvo?", value: "alunos, pais" },
      { label: "Orientação (cores & tamanho)?", value: "Faz o que Jesus tocar" },
    ]);
    expect(htmlToText(result.html)).toBe("Quero algo WOW!");
  });

  it("mensagem sem resumo passa intacta", () => {
    expect(extractFormAnswers("<p>Oi</p>")).toEqual({ html: "<p>Oi</p>", answers: [] });
  });
});

describe("citação (Responder)", () => {
  it("makeExcerpt: uma linha, corta com reticências", () => {
    expect(makeExcerpt("Olá\n\n  tudo   bem?")).toBe("Olá tudo bem?");
    expect(makeExcerpt("a".repeat(300), 10)).toBe("aaaaaaaaa…");
  });

  it("extractReplyQuote: só o bloco do início, tolerando atributos que o Zammad acrescente", () => {
    const html =
      '<blockquote type="cite"><p dir="auto"><strong>Felipe Cardoso</strong></p><p dir="auto">Nesta semana foi realocado o access point…</p></blockquote><p>Obrigado!</p>';
    const result = extractReplyQuote(html);
    expect(result.quote).toEqual({ author: "Felipe Cardoso", excerpt: "Nesta semana foi realocado o access point…" });
    expect(htmlToText(result.html)).toBe("Obrigado!");
    // citação no FIM (e-mail) não é cartão: continua sendo descartada
    expect(extractReplyQuote("<p>Oi</p><blockquote><p><strong>X</strong></p><p>y</p></blockquote>").quote).toBeNull();
  });

  it("composeReplyBody e extractReplyQuote são inversos (com HTML escapado)", () => {
    const body = composeReplyBody("Obrigado!\nAbs", { author: "Ana <b>", excerpt: "a & b" });
    expect(body).toBe("<blockquote><p><strong>Ana &lt;b&gt;</strong></p><p>a &amp; b</p></blockquote><p>Obrigado!<br>Abs</p>");
    const parsed = extractReplyQuote(body);
    expect(parsed.quote).toEqual({ author: "Ana <b>", excerpt: "a & b" });
    expect(htmlToText(parsed.html)).toBe("Obrigado!\nAbs");
    expect(composeReplyBody("Oi")).toBe("<p>Oi</p>");
  });
});

describe("cleanSenderName", () => {
  it("tira o 'via Helpdesk' e o e-mail", () => {
    expect(cleanSenderName("Felipe Cardoso via Zammad Helpdesk Support <suporte@erasto.com.br>")).toBe("Felipe Cardoso");
    expect(cleanSenderName("Adoniran de Souza Bail")).toBe("Adoniran de Souza Bail");
    expect(cleanSenderName("-")).toBe("");
    expect(cleanSenderName(null)).toBe("");
  });
});
