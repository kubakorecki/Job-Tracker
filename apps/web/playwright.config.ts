import { defineConfig, devices } from "@playwright/test";
import { loadTestEnv } from "./lib/load-env";

// The end-to-end user's credentials. Playwright runs outside Next, which is
// the only thing that reads an environment file on its own.
loadTestEnv();

const BASE_URL = "http://localhost:3000";

/**
 * Where the signed-in session is kept between the setup project and the test.
 * Written on every run rather than committed: a Supabase access token is
 * short-lived, and a stale one would fail as a 401 in the middle of a test
 * rather than as a sign-in that did not work.
 */
export const SESSION_FILE = "e2e/.auth/session.json";

/**
 * The smoke test. It drives the real dev server against the dev Supabase
 * project (ADR-0003) — there is no local stack and nothing is stubbed, which
 * is the entire point of it, and also why it fails while that project is
 * paused.
 */
export default defineConfig({
  testDir: "./e2e",
  // One test against one shared remote database. Parallelism here would buy
  // nothing and cost the same collisions the API tests run serially to avoid.
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "smoke",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: SESSION_FILE },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: BASE_URL,
    // Attach to the dev server if one is already up, so a run costs nothing
    // extra while developing.
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
