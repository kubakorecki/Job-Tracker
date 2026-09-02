# 13: Playwright smoke test

**What to build:** One end-to-end test proving the dashboard, API and database are genuinely wired together — not a substitute for the API tests, which carry the behavioural coverage.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] A single test signs in, adds a Job Application manually, changes its Status, reloads, and confirms it persisted
- [ ] It runs against the local dev server pointed at the dev Supabase project
- [ ] It signs in through the real form using credentials from a gitignored test environment file, and reuses the stored session afterwards
- [ ] Its account is separate from the API tests' user, so neither can disturb the other
- [ ] It removes the Job Application it created, so reruns don't accumulate data
- [ ] It is documented as requiring a live, unpaused dev project
