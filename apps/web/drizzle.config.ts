import { defineConfig } from "drizzle-kit";
import { loadLocalEnv } from "./lib/load-env";
import { directDatabaseUrl } from "./lib/env";

loadLocalEnv();

/**
 * Migrations run over the direct connection: the transaction pooler does not
 * support the session-level DDL that `CREATE TYPE` and friends need (ADR-0003).
 */
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: { url: directDatabaseUrl() },
});
