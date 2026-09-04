import { z } from "zod";

/**
 * The Supabase project this deployment talks to. Read lazily rather than at
 * module load, so a build with no environment file still succeeds and the
 * failure lands on the first request, where the message is readable.
 *
 * The two variables are named literally because Next.js only inlines
 * `NEXT_PUBLIC_*` reads it can see statically — `process.env[name]` would
 * compile to `undefined` in the browser bundle.
 */
const SupabaseEnv = z.object({
  url: z.url({ error: "NEXT_PUBLIC_SUPABASE_URL must be the project URL" }),
  anonKey: z
    .string()
    .min(1, { error: "NEXT_PUBLIC_SUPABASE_ANON_KEY must be set" }),
});

export type SupabaseEnv = z.infer<typeof SupabaseEnv>;

export function supabaseEnv(): SupabaseEnv {
  const parsed = SupabaseEnv.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    throw new Error(
      `Supabase is not configured. Copy apps/web/.env.example to apps/web/.env.local and fill it in.\n${parsed.error.issues
        .map((issue) => `  - ${issue.message}`)
        .join("\n")}`,
    );
  }

  return parsed.data;
}

/**
 * Where Drizzle connects. Read lazily for the same reason as `supabaseEnv` —
 * a build with no environment file should still succeed.
 *
 * Two variables rather than one switched by environment: the application uses
 * the transaction pooler, whose port cannot run session-level DDL, so
 * migration tooling needs the direct connection alongside it (ADR-0003).
 */
export function databaseUrl(): string {
  return requireEnv("DATABASE_URL", process.env.DATABASE_URL);
}

/** The direct connection, used only by migration tooling. */
export function directDatabaseUrl(): string {
  return requireEnv("DIRECT_URL", process.env.DIRECT_URL);
}

/**
 * The AI Studio developer key the extraction endpoint calls Gemini with. Read
 * lazily like the rest, and read nowhere else: extraction is the only thing
 * that needs it, so a test run and a build both start without it.
 */
export function geminiApiKey(): string {
  return requireEnv("GEMINI_API_KEY", process.env.GEMINI_API_KEY, "AI Studio");
}

/**
 * The Supabase service role key, which the CV store reaches Storage with.
 *
 * Storage is the one part of Supabase this app cannot address as the database
 * owner: every object lives behind Row Level Security on `storage.objects`,
 * and there are no policies, because the schema has none anywhere (ADR-0001).
 * The service key is what makes the bucket reachable at all, and the same
 * bargain applies to it as to `DATABASE_URL` — it grants everything, so tenant
 * isolation is enforced in application code, in the one module that holds it.
 *
 * It is never `NEXT_PUBLIC_`, is read lazily like the rest, and is read
 * nowhere but `lib/profile/storage.ts`.
 */
export function supabaseServiceRoleKey(): string {
  return requireEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

function requireEnv(
  name: string,
  value: string | undefined,
  where = "the Supabase dashboard",
): string {
  const parsed = z.string().min(1).safeParse(value);

  if (!parsed.success) {
    throw new Error(
      `${name} is not set. Copy apps/web/.env.example to apps/web/.env.local and fill it in from ${where}.`,
    );
  }

  return parsed.data;
}
