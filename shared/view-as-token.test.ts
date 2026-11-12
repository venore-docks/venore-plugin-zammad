import { describe, expect, it } from "vitest";
import { signViewAs, verifyViewAs } from "./view-as-token";

const SECRET = "segredo-de-teste";
const NOW = 1_800_000_000;
const payload = { by: "admin-1", target: "user-2", exp: NOW + 60 };

describe("token do ver como", () => {
  it("aceita o token assinado, para quem o criou, antes de expirar", () => {
    expect(verifyViewAs(signViewAs(payload, SECRET), SECRET, "admin-1", NOW)).toEqual(payload);
  });

  it("recusa outra sessão, token expirado ou segredo diferente", () => {
    const token = signViewAs(payload, SECRET);
    expect(verifyViewAs(token, SECRET, "outro-admin", NOW)).toBeNull();
    expect(verifyViewAs(token, SECRET, "admin-1", NOW + 61)).toBeNull();
    expect(verifyViewAs(token, "outro-segredo", "admin-1", NOW)).toBeNull();
  });

  it("recusa token adulterado ou malformado", () => {
    const token = signViewAs(payload, SECRET);
    const [, signature] = token.split(".");
    const forged = `${Buffer.from(JSON.stringify({ ...payload, target: "user-3" })).toString("base64url")}.${signature}`;
    expect(verifyViewAs(forged, SECRET, "admin-1", NOW)).toBeNull();
    expect(verifyViewAs("lixo", SECRET, "admin-1", NOW)).toBeNull();
    expect(verifyViewAs(`${token}.extra`, SECRET, "admin-1", NOW)).toBeNull();
  });

  it("recusa ver a si mesmo", () => {
    const token = signViewAs({ by: "admin-1", target: "admin-1", exp: NOW + 60 }, SECRET);
    expect(verifyViewAs(token, SECRET, "admin-1", NOW)).toBeNull();
  });
});
