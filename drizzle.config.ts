import { defineConfig } from "drizzle-kit";

// Migrations próprias do plugin (mesmo padrão de venore-plugin-calendarios/drizzle.config.ts): tabela de tracking
// própria, para não dividir o cursor de "última migration aplicada" com o core. Gerar com scripts/db-generate.ps1.
export default defineConfig({
  schema: ["./database/schema/index.ts"],
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  migrations: { schema: "colabora_migrations", table: "__drizzle_migrations" },
});
