# 03: Add a Job Application manually and see it listed

**What to build:** The user can record a job by hand — with or without a Posting URL — and see it appear in their list. This is the first path that touches the database, and it stands up the test harness every later ticket will use.

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [x] A Job Applications table exists, mirroring the shared contract, with no foreign key into the auth schema
- [x] Every query goes through a repository module that takes the user identifier as a non-optional argument; no request handler builds a query inline (ADR-0001)
- [x] A current-user resolver reads the session cookie and rejects unauthenticated requests
- [x] A user can create a Job Application supplying only company and job title
- [x] A user can create a Job Application with no URL, so referrals and recruiter emails are recordable
- [x] A user can list their own Job Applications, optionally filtered by Status
- [x] A user never receives another user's Job Applications from any endpoint
- [x] An add form validates against the shared contract before submitting
- [x] Saved Job Applications render in a list showing company, job title, applied date and Status
- [x] A test runner is configured, running serially against the dev project with a dedicated test user distinct from the human's account
- [x] Tests create the data they need and remove it afterwards; none assume an empty database
- [x] A test proves a second user's Job Applications are never returned

## Comments

Implemented in `apps/web`:

- `lib/db/schema.ts` is the `job_applications` table, mirroring the shared
  contract. `job_status` and `remote_type` are Postgres enums generated from
  `JobStatus.options` and `RemoteType.options`, so a Status added to
  `@repo/schema` turns into a migration rather than drifting. `user_id` carries
  no foreign key into `auth.users`. The normalized-URL column and its partial
  unique index per user are here too — the column belongs to the table's shape,
  and adding it later would be a migration for no reason.
- `lib/job-applications/repository.ts` holds every query. Each function takes
  the owner's id as its first argument, and nothing else in the app builds a
  query: the dashboard page reads through `listJobApplications`, and
  `app/api/job-applications/route.ts` is two lines of export.
- `lib/api/authenticated-route.ts` is where a 401 is decided, once. Ticket 07
  extends the resolver underneath it and every endpoint gains Bearer tokens at
  the same moment.
- `lib/job-applications/api.ts` holds the two endpoints as plain
  request-to-response functions taking the resolved user. That is what makes
  them callable in a test with no session and no auth service, which is the
  whole reason the API can be the only backend seam.
- The dashboard gained an add form validating against `CreateJobApplication`
  before it posts, and a list showing company, job title, applied date and a
  Status badge. `JOB_STATUS_LABELS` moved out of `@repo/ui`'s badge so the
  form's select and the badge cannot disagree about how a Status is written.
- Connection: postgres.js on the pooled URL with `prepare: false`, migrations
  over the direct URL via `pnpm --filter web db:generate` / `db:migrate`.

Decisions worth knowing about:

- **The API test users are literal UUIDs**, not Supabase accounts
  (`lib/test-support/users.ts`). No column has a foreign key into the auth
  schema, so a test needs an identifier rather than a session — and a fixed one
  can never be the human's account. `docs/setup/supabase.md` no longer asks for
  an API-test account; the Playwright user in ticket 13 still needs a real one.
- **A test runner already existed per workspace** (ticket 01, then 02), so the
  API suite joined that arrangement rather than half-moving to the root runner
  the spec imagined. `apps/web/vitest.config.ts` sets `fileParallelism: false`,
  because these tests share one remote database and the unique index makes two
  workers on the same Posting collide.
- **Duplicate Postings return 409 rather than crashing.** The behaviour the
  panel needs — recognising an already-saved Posting, looking one up by URL —
  is still ticket 12's. But this ticket creates the unique index and an endpoint
  that can trip it, so the mapping from `unique_violation` to a status code is
  part of shipping that endpoint rather than a preview of 12.
- **Creating a Job Application as `applied` stamps the applied date.** Without
  it, this ticket's own list showed "Not applied" against a Job Application the
  user had just recorded as applied. Ticket 04 owes the same rule to a Status
  change, where the date must also survive a later move.
- `apps/web/.env.prod` was untracked but not ignored — one `git add -A` from
  being committed. `.gitignore` now covers `.env*` with `.env.example` excepted.

Reviewed on both axes afterwards. Acted on: `lib/jobs/` became
`lib/job-applications/`, since the glossary lists `job` under _Avoid_; three
comments citing ADR-0001 for the no-foreign-key decision were corrected, as the
ADR carries only the isolation half of that argument and the reason is the
spec's; `requireUrl` became `requireEnv`, which is what it checks;
`invalidRequest` was inlined into its one call site; `updatedAt` gained
`$onUpdate`. Left alone deliberately: `toJobApplication` maps each field by
hand rather than spreading, because the explicit list is what keeps a
database-only column out of an API response, and a contract field added later
fails to compile rather than vanishing quietly; `deleteJobApplication` has no
endpoint until ticket 05, but tests must remove their own rows and a query may
not live anywhere but the repository.

Verified against the live dev project: the migration applied, 28 tests pass
serially and leave no rows behind, and against a running server an
unauthenticated `GET /api/job-applications` is a 401 with a JSON body — not a
redirect — while `/dashboard` still 307s to `/sign-in`.

**Still needs a human**: signing in and adding a Job Application through the
form in a browser, which needs the dev account's password. The endpoints,
scoping and persistence underneath it are covered by the tests.
