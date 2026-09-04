# 13: Playwright smoke test

**What to build:** One end-to-end test proving the dashboard, API and database are genuinely wired together — not a substitute for the API tests, which carry the behavioural coverage.

**Blocked by:** 04

**Status:** ready-for-agent

- [x] A single test signs in, adds a Job Application manually, changes its Status, reloads, and confirms it persisted
- [x] It runs against the local dev server pointed at the dev Supabase project
- [x] It signs in through the real form using credentials from a gitignored test environment file, and reuses the stored session afterwards
- [x] Its account is separate from the API tests' user, so neither can disturb the other
- [x] It removes the Job Application it created, so reruns don't accumulate data
- [x] It is documented as requiring a live, unpaused dev project

## Comments

`apps/web/playwright.config.ts`, `apps/web/e2e/`, run with
`pnpm test:e2e` (root) or `pnpm --filter web test:e2e`.

One test: sign in, add a Job Application on the dashboard, open it, change its
Status to Interviewing, save, reload the board, and find the card under the
Interviewing column. The reload is the assertion — nothing of the change is
left in the browser, so the card can only be there if the database holds it.

Decisions worth knowing about:

- **The Status change goes through the detail view's select, not a drag.** The
  board's keyboard sensor moves a dragged card twenty-five pixels an arrow
  press, so a drag between columns would encode the column width in the test
  and break the first time the layout moves. The board is still what the
  assertion reads: after the reload the card has to be inside
  `<section aria-label="Interviewing">`, which is the column. Dragging a card
  by hand remains the thing ticket 04 left for a human.
- **Credentials live in `apps/web/.env.test`, not `.env.local`.** Two files
  rather than two more lines, so the account a test signs in as can never be
  the developer's own — otherwise a run would edit real Job Applications.
  `.env.test.example` is committed and says where the account comes from;
  `lib/load-local-env.ts` became `lib/load-env.ts` and grew a `loadTestEnv`
  beside `loadLocalEnv`, since Playwright runs outside Next exactly as the
  migration tooling and vitest do.
- **The session is saved once per run, not committed.** A `setup` project signs
  in through the real form and writes `e2e/.auth/session.json`, which the smoke
  project reuses. Checking that file in would mean a Supabase access token
  expiring into a 401 in the middle of a test rather than a sign-in that plainly
  did not work. Signing in through the form rather than minting a session is
  also what keeps sign-in itself covered.
- **Cleanup is `afterEach` through the API, keyed on a company prefix.** Every
  Job Application the test makes is named `Playwright Smoke <timestamp>`, and
  the hook deletes every row that matches — so a run that failed before it
  reached the end still leaves nothing behind, and the next run clears what the
  last one could not.
- **Not part of `pnpm test`.** It needs a browser and a dev server, so it is a
  `test:e2e` task of its own. The config starts `next dev` unless port 3000 is
  already answering.

The account is a second user in the `job-tracker-dev` project, separate from
the human's; the API tests need no account at all, since their two users are
fixed identifiers rather than sessions. A paused dev project fails the sign-in
step and says nothing useful about why — README and `docs/setup/supabase.md`
both say so.

Ran green twice in a row against the dev project, leaving no rows behind.
Typecheck, lint and the 161 unit and API tests are clean.
