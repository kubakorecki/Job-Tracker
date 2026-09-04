/**
 * Reads this app's environment files into `process.env`. Next.js does this
 * itself for the app; the test runners and the migration tooling run outside
 * Next and would otherwise see none of it.
 *
 * A missing file is not an error: on a deployment the same variables arrive
 * from the environment, and the code that needs one says so when it is absent.
 */

/** `apps/web/.env.local` — the dev Supabase project, the Gemini key. */
export function loadLocalEnv(): void {
  load(".env.local");
}

/**
 * `apps/web/.env.test` — the end-to-end user, and nothing else. It is a second
 * file rather than more lines in the first so that the credential a test signs
 * in with is never the developer's own (docs/setup/supabase.md).
 */
export function loadTestEnv(): void {
  load(".env.test");
}

function load(file: string): void {
  try {
    process.loadEnvFile(new URL(`../${file}`, import.meta.url));
  } catch {
    // No such environment file — whatever is already in `process.env` stands.
  }
}
