// `@venore/plugin-sdk` para os testes de integração: o `db` é um Postgres em memória (PGlite) com as migrations
// do plugin aplicadas (mesmo esquema de venore-plugin-calendarios/tests/integration/mocks.ts).
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

const client = new PGlite();
export const db = drizzle(client);

export async function applyMigrations(dir: string) {
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = fs.readFileSync(`${dir}/${file}`, "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) await client.exec(statement);
    }
  }
}
