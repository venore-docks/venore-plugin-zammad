import { describe, expect, it } from "vitest";
import { describeTag, describeTags } from "./tag-labels";

describe("tags", () => {
  it("tags do fluxo ganham nome e cor; as outras ficam neutras", () => {
    expect(describeTag("nao-autorizado")).toMatchObject({ label: "Não autorizado", color: "danger" });
    expect(describeTag("Ajustes")).toMatchObject({ label: "Ajustes", color: "warning" });
    expect(describeTag("reenviado")).toMatchObject({ color: "primary" });
    expect(describeTag("elevador")).toMatchObject({ label: "elevador", color: "neutral" });
  });

  it("ordena por atenção e remove repetidas e vazias", () => {
    expect(describeTags(["zeta", "ajustes", "rejeitado", "ajustes", " ", "alfa"]).map((tag) => tag.label)).toEqual(["Rejeitado", "Ajustes", "alfa", "zeta"]);
  });
});
