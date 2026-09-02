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
