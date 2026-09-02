/**
 * Reads `apps/web/.env.local` into `process.env`. Next.js does this itself for
 * the app; the test runner and the migration tooling run outside Next and
 * would otherwise see none of it.
 *
 * A missing file is not an error: on a deployment the same variables arrive
 * from the environment, and the code that needs one says so when it is absent.
 */
export function loadLocalEnv(): void {
  try {
    process.loadEnvFile(new URL("../.env.local", import.meta.url));
  } catch {
    // No local environment file — whatever is already in `process.env` stands.
  }
}
