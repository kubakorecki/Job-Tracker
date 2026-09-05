import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { databaseUrl } from "../env";
import * as schema from "./schema";

let client: ReturnType<typeof connect> | null = null;

/**
 * The one connection this process makes. Created on first use rather than at
 * module load, so importing anything that touches the database — a repository
 * module, a route handler — costs nothing until a query actually runs.
 */
export function db() {
  client ??= connect();
  return client;
}

function connect() {
  return drizzle({
    client: postgres(poolableUrl(databaseUrl()), {
      // The transaction pooler hands each statement to whichever backend is
      // free, so a prepared statement is never found on the connection that
      // prepared it.
      prepare: false,
    }),
    schema,
  });
}

/**
 * Drops `pgbouncer=true` from the connection URL. It is Prisma's flag, but the
 * Supabase dashboard prints it on the pooled URL for everyone, and postgres.js
 * forwards any parameter it does not recognise to the server as a startup
 * option — where an unknown one closes the connection.
 */
function poolableUrl(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.delete("pgbouncer");
  return parsed.toString();
}

/**
 * The handle a `db().transaction` callback is given, read off the client
 * rather than named, so it follows the schema without being restated.
 */
export type Transaction = Parameters<
  Parameters<ReturnType<typeof db>["transaction"]>[0]
>[0];

/**
 * Anything a statement can be run on: the client itself, or a transaction on
 * it. Repository functions that may be called either on their own or as part
 * of somebody else's transaction take one of these, so that the caller decides
 * what has to succeed together rather than the callee.
 */
export type Queryable = ReturnType<typeof db> | Transaction;
