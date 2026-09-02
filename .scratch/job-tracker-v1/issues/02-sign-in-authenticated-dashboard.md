# 02: Sign in and reach an authenticated dashboard

**What to build:** The user can sign in with email and password and land on their own dashboard; signed out, they can't reach it at all. This proves the authentication half of the stack end to end, before any table exists.

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

- [ ] Two Supabase Free-plan projects exist, dev and prod, per ADR-0003
- [ ] Environment variables are documented and in place for both, including separate pooled and direct database URLs
- [x] The account is created by hand in the dashboard; there is no self-serve sign-up page (ADR-0001)
- [x] A sign-in page accepts email and password and reports bad credentials clearly
- [x] A signed-in session survives a browser restart
- [x] Visiting the dashboard while signed out redirects to sign-in rather than rendering an empty board
- [x] Signing out ends the session and returns the user to sign-in

## Comments

Implemented in `apps/web`:

- `proxy.ts` (Next 16's `middleware.ts`) refreshes the Supabase session on
  every request and applies `lib/auth/route-access.ts`, which is a pure
  function over `{ pathname, signedIn }` and is unit-tested. It lists the
  public routes rather than the private ones, so a page added later is guarded
  by default.
- `/sign-in` is a server action over `signInWithPassword`.
  `lib/auth/sign-in-error.ts` maps the failure to a message the user can act
  on — bad credentials, unconfirmed email and rate limiting each read
  differently, and anything unrecognised blames the service rather than the
  user. Also unit-tested. There is no sign-up action anywhere.
- `/dashboard` resolves the current user through
  `lib/auth/current-user.ts`, which verifies the JWT with `getClaims()` rather
  than trusting the cookie's contents. Ticket 07 extends that one resolver
  with Bearer tokens.
- Sign-out is a server action that clears the session and redirects.
- `@supabase/ssr` writes its auth cookies with a 400-day `maxAge`, so the
  session is persistent rather than per-window and survives a browser restart.
- A vitest project was added to `apps/web` for the two pure seams above,
  alongside the existing one in `packages/schema` rather than at the root.
  The spec's testing section imagined a root runner with per-workspace
  projects; ticket 01 had already established per-workspace configs, and
  turbo's `test` task already fans out across them. Ticket 03 should add its
  serial, dev-project-backed API suite the same way, or move all three at
  once — not inherit a half-moved arrangement.
- `apps/web/.env.example` documents all four variables, including the pooled
  `DATABASE_URL` and the direct `DIRECT_URL`; they are declared in
  `turbo.json`'s `globalEnv`. `docs/setup/supabase.md` covers project
  creation, creating the accounts by hand, and unpausing.

Verified locally with placeholder credentials: `/`, `/dashboard` and an
as-yet-nonexistent `/settings/tokens` all return 307 to `/sign-in` while
signed out, and `/sign-in` renders. `pnpm build`, `pnpm lint`,
`pnpm check-types` and `pnpm test` all pass.

Reviewed on both axes afterwards. Acted on: the guard now excludes `/api`
from its matcher, so ticket 07's Bearer-authenticated calls get a 401 rather
than a 307 at an HTML page and no preflight pays for a session lookup;
`RouteAccess["to"]` narrowed from `string` to the two known paths; the
dashboard's decorative Status badges are gone, since naming four of the six
Statuses a "pipeline" asserted something the glossary contradicts and the
board belongs to ticket 04. Left alone deliberately: `supabaseEnv()` still
throws on every path when `.env.local` is absent, which is the right noise for
an app that cannot function without it.

**Still needs a human**, because it cannot be done from here:

- The first two boxes: create `job-tracker-dev` and `job-tracker-prod`, create
  the accounts (including the separate API-test and end-to-end users), and
  fill in `apps/web/.env.local`. `docs/setup/supabase.md` is the walkthrough.
- Once that exists, confirm against the live project: signing in lands on
  `/dashboard`, a wrong password shows the credentials message, the session
  survives a browser restart, and signing out returns to `/sign-in`.
