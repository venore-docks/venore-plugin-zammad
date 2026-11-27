import { describe, expect, it } from "vitest";
import { bodyGuidanceFor } from "./hints";

describe("bodyGuidanceFor", () => {
  it("Acesso a sistemas: exemplo e perguntas do assunto, nada de hardware", () => {
    const guidance = bodyGuidanceFor(["Acesso a sistemas", "Tecnologia"]);
    expect(guidance.example).toBe("Criar conta para Maria Souza no Prime");
    expect(guidance.lines.join(" ")).not.toMatch(/sala|projetor|equipamento/i);
  });

  it("o subgrupo vale antes do pai (Tecnologia > Desenvolvimento)", () => {
    expect(bodyGuidanceFor(["Desenvolvimento", "Tecnologia"]).example).toMatch(/Portal/);
    expect(bodyGuidanceFor(["Infraestrutura", "Tecnologia"]).example).toMatch(/Wi-Fi/);
  });

  it("sem acento e sem caixa: “Manutenção” e “RECURSOS HUMANOS”", () => {
    expect(bodyGuidanceFor(["Manutenção"]).example).toMatch(/Torneira/);
    expect(bodyGuidanceFor(["RECURSOS HUMANOS"]).example).toMatch(/cadastro/);
  });

  it("setor desconhecido recebe uma ajuda neutra (sem hardware)", () => {
    const guidance = bodyGuidanceFor(["Eventos"]);
    expect(guidance.lines).toHaveLength(4);
    expect(guidance.lines.join(" ")).not.toMatch(/projetor|prédio/i);
  });
});
