import { z } from "zod";

/**
 * The account the smoke test signs in as, out of `apps/web/.env.test`.
 *
 * A file of its own rather than `.env.local`: this is the one credential that
 * belongs to a test rather than to the developer sitting here, and keeping the
 * two apart is what stops a run from signing in as the human and editing real
 * Job Applications. Both files are gitignored; `.env.test.example` names what
 * goes in this one.
 */
const E2eEnv = z.object({
  email: z.email({ error: "E2E_EMAIL must be the end-to-end user's address" }),
  password: z.string().min(1, { error: "E2E_PASSWORD must be set" }),
});

export type E2eEnv = z.infer<typeof E2eEnv>;

/**
 * Read at call time rather than on import, so that `playwright test --list`
 * and `--help` work in a checkout that has no `.env.test` yet.
 */
export function e2eCredentials(): E2eEnv {
  const parsed = E2eEnv.safeParse({
    email: process.env.E2E_EMAIL,
    password: process.env.E2E_PASSWORD,
  });

  if (!parsed.success) {
    throw new Error(
      `The end-to-end user is not configured. Copy apps/web/.env.test.example to apps/web/.env.test and fill it in with the end-to-end user you made in the dev project (docs/setup/supabase.md).\n${parsed.error.issues
        .map((issue) => `  - ${issue.message}`)
        .join("\n")}`,
    );
  }

  return parsed.data;
}
