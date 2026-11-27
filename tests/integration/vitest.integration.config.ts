import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Teste de integração do banco do Colabora contra Postgres EM MEMÓRIA (PGlite): roda a partir do core (vitest e
// drizzle-orm dele), com scripts/run-tests.ps1 -Integration. `@venore/plugin-sdk` vira ./mocks.ts (o `db` do PGlite).
// Nenhum banco real é tocado.
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url)).replaceAll("\\", "/");
const core = process.env.CORE_DIR ?? here("../../../venore-docks");
const mocks = here("./mocks.ts");

export default defineConfig({
  root: core,
  resolve: {
    alias: [
      { find: /^@venore\/plugin-sdk$/, replacement: mocks },
      { find: /^server-only$/, replacement: `${core}/src/test-support/stubs/server-only.ts` },
    ],
  },
  server: { fs: { strict: false } },
  test: {
    environment: "node",
    include: [here("./*.integration.test.ts")],
    testTimeout: 60000,
    server: { deps: { inline: [/drizzle-orm/] } },
  },
});
