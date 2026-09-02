import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    /**
     * The API tests share one remote database — there is no local stack
     * (ADR-0003) — and the unique index on a Posting per user makes two
     * workers touching the same URL collide. Serial is the honest arrangement.
     */
    fileParallelism: false,
  },
});
