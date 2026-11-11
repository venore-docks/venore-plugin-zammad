import { describe, expect, it } from "vitest";
import { articleToText, cleanSenderName, htmlToText } from "./html-text";

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

describe("cleanSenderName", () => {
  it("tira o 'via Helpdesk' e o e-mail", () => {
    expect(cleanSenderName("Felipe Cardoso via Zammad Helpdesk Support <suporte@erasto.com.br>")).toBe("Felipe Cardoso");
    expect(cleanSenderName("Adoniran de Souza Bail")).toBe("Adoniran de Souza Bail");
    expect(cleanSenderName("-")).toBe("");
    expect(cleanSenderName(null)).toBe("");
  });
});
