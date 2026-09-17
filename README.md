# Job Tracker

A personal tracker for job applications: a Next.js dashboard you fill in by
hand, and a Chrome side panel that reads the job posting you are looking at
and offers to save it. Both go through the same API, which is the only thing
that touches the Postgres database on Supabase.

The vocabulary this repo uses — Posting, Job Application, Status, Draft,
Personal Access Token — is defined in [`CONTEXT.md`](CONTEXT.md), and the
decisions that shaped it are in [`docs/adr/`](docs/adr/). Read those two when
a name or a constraint here looks arbitrary; they are where the reasons live.

## Apps and packages

- `apps/web` — Next.js dashboard (App Router, Tailwind v4). Serves both the UI
  and the API route handlers under `app/api` that the extension calls.
- `apps/extension` — Chrome extension (Manifest V3, built with
  [WXT](https://wxt.dev)). A side panel with no popup — the toolbar icon opens
  it directly. It asks for a Personal Access Token and an API base URL on first
  run, then offers to save the Posting in the active tab and lists the most
  recent Job Applications.
- `packages/schema` — Zod schemas (`JobApplication`, `StatusChange`,
  `Contact`, ...). The single source of truth for data shapes, consumed
  by both apps.
- `packages/ui` — Shared React components (`Card`, `StatusBadge`, ...) built
  with Tailwind v4, consumed by both `web` and the extension's side panel.
- `packages/eslint-config`, `packages/typescript-config`, `packages/tailwind-config` —
  shared tooling config.

## Setting up from cold

You need Node 24 or newer, pnpm 11 (`corepack enable` picks up the version
pinned in `package.json`), and Chrome.

**1. Install.**

```sh
pnpm install
```

**2. Create the two Supabase projects.** Development and production each run
against their own cloud project and there is no local stack (ADR-0003), so
this is the one step that cannot be done offline. In one organisation on the
Free plan, create `job-tracker-dev` and `job-tracker-prod`, noting each
project's database password — the dashboard does not show it again. The Free
plan allows exactly two active projects, which is why there is no third.

**3. Create the account by hand.** There is no sign-up page and there will not
be one (ADR-0001), so the account is made in the dashboard:
**Authentication → Users → Add user → Create new user**, with _Auto Confirm
User_ ticked — without it, sign-in fails with "email address hasn't been
confirmed". In the dev project make two users: the one you develop as, and a
separate one for the Playwright test, so that a test run can never edit your
own Job Applications. The API tests need no account at all; their users are
fixed identifiers in `apps/web/lib/test-support/users.ts`.

**4. Fill in the environment files.**

```sh
cp apps/web/.env.example apps/web/.env.local
cp apps/web/.env.test.example apps/web/.env.test
```

Both `.example` files name where each value lives in the Supabase dashboard;
the section below says what each variable is for.

**5. Create the tables.**

```sh
pnpm --filter web db:migrate
```

This applies the migrations in `apps/web/drizzle/` over `DIRECT_URL`. Do it
for the production project too, with that project's URL in the environment —
see `docs/setup/deployment.md`.

**6. Sign in.** `pnpm dev`, then http://localhost:3000. Signed out it
redirects to `/sign-in`; the account from step 3 lands you on `/dashboard`.

`docs/setup/supabase.md` walks the same path in more detail, including where
in the dashboard each screen is.

## Environment variables

`apps/web/.env.local` holds six variables. Everything without a
`NEXT_PUBLIC_` prefix is **server-only**: it is read in route handlers and
server components and never reaches the browser bundle, and none of it is
readable by the extension.

| Variable                        | Where it is read               | Purpose                                                                     |
| ------------------------------- | ------------------------------ | --------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | browser and server             | The Supabase project's URL, for Auth.                                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser and server             | The anon key. Safe to expose: it grants only what a signed-in session does. |
| `DATABASE_URL`                  | server only                    | Transaction pooler, port 6543. Every application query.                     |
| `DIRECT_URL`                    | tooling only, never at runtime | Session pooler, port 5432. Drizzle migrations.                              |
| `EXTENSION_ORIGIN`              | server only                    | The `chrome-extension://` origin the API's CORS allowlist trusts.           |
| `GEMINI_API_KEY`                | server only                    | Read lazily by the extraction endpoint alone.                               |

`NODE_ENV` is read too — `lib/api/cors.ts` allows `http://localhost:3000` as
an origin outside production — but it is set by the framework and by the
scripts, never by you.

Two more live outside that file. `apps/web/.env.test` holds `E2E_EMAIL` and
`E2E_PASSWORD` — the Playwright account, kept in a second file precisely so it
cannot be the account you develop against. `WXT_API_BASE_URL` is optional and
belongs to the extension's build rather than the web app; see
[Connecting the extension](#connecting-the-extension).

### Why there are two database URLs

They are two variables rather than one switched by environment because they
address the same database for different reasons and cannot be interchanged:

- **`DATABASE_URL` is the transaction pooler (6543).** The app runs as a
  process per request in production, and would otherwise open a Postgres
  connection per request. That pooler hands each statement to whichever
  backend is free, so `lib/db/client.ts` passes `prepare: false` — a prepared
  statement would never be found on the connection that prepared it. The same
  file strips the `pgbouncer=true` the dashboard prints on the URL, which
  postgres.js would forward as an unknown startup option.
- **`DIRECT_URL` is the session pooler (5432).** Migrations run session-level
  DDL — `CREATE TYPE` and friends — which the transaction pooler cannot do.
  Nothing at runtime opens this connection.

Take **both** from the dashboard's **Connect** panel, and take the pooler
hosts. The "Direct connection" offered alongside them —
`db.<ref>.supabase.co` — resolves to IPv6 only, and a machine or CI runner
with no IPv6 route fails every query with `ENOTFOUND`. The session pooler is
the same connection over IPv4.

## Running it in development

```sh
pnpm dev      # web + extension, both in watch mode
```

- **Web app**: http://localhost:3000.
- **Extension dev server**: http://localhost:3001, pinned in `wxt.config.ts`
  so it cannot land on the web app's port, where both servers would answer and
  a browser would reach whichever address it resolved first.
- **Loading the extension**: `pnpm --filter extension dev` opens a Chrome
  instance with it already installed. To load it into your own Chrome instead:
  `chrome://extensions` → enable Developer Mode → "Load unpacked" →
  `apps/extension/.output/chrome-mv3`. Click the toolbar icon to open the side
  panel; there is no popup.

### Connecting the extension

The panel has no session cookie and no sign-in, so on first run it asks for
two things:

1. **A Personal Access Token.** Generate one on the dashboard at
   **/settings/tokens**. It is shown once and only its hash is stored, so
   copy it then.
2. **An API base URL** — which Job Tracker this panel talks to.

Paste both into the panel's setup form and save. The same form is where a
refused token lands, since revoking or mistyping one has exactly this remedy.

The URL field is pre-filled with a default chosen at **build** time, not at
run time, so a development build talks to your dev server and a production
build to the deployment without either carrying a switch:

- `WXT_API_BASE_URL`, if set on the build command, wins. It is for a build
  aimed at a preview deployment, and is named in `turbo.json`'s `globalEnv` so
  a cached build is not reused across two different values.
- Otherwise a dev build (`pnpm dev`) uses `http://localhost:3000`, and a
  production build (`pnpm build`) uses the deployed app.

Whatever it resolves to is only a default. It fills the field in; the value
you save is the one the panel uses. See `apps/extension/lib/settings.ts`.

The extension's id is pinned by a public key committed in its manifest, so it
is `okeljopaafaojopfkhjioaceeohjplhb` wherever this repository is built rather
than something Chrome invents per checkout. That is the value the API's CORS
allowlist trusts, as `EXTENSION_ORIGIN`.

## Commands

Run from the repo root:

```sh
pnpm build         # build all apps and packages
pnpm lint          # lint all apps and packages
pnpm check-types   # type-check all apps and packages
pnpm test          # run every workspace's tests
pnpm test:e2e      # run the Playwright smoke test
pnpm format        # prettier over ts, tsx and md
```

## Running the tests

**`pnpm test`** is Vitest: the schema package's tests, which need nothing, and
the web app's API tests, which need `apps/web/.env.local` filled in and the
**dev Supabase project unpaused** — there is no local stack and nothing is
stubbed (ADR-0003). A paused project fails them all. They run **serially**
(`fileParallelism: false`): one shared remote database plus a unique index on
a Posting per user means two workers touching the same URL collide. They
create the rows they need and delete them afterwards.

**`pnpm test:e2e`** is one Playwright test — sign in, add a Job Application,
change its Status, reload, confirm it persisted. It is deliberately not part
of `pnpm test`, since it needs a browser and a running dev server. It exists
to prove the dashboard, the API and the database are wired together at all;
the API tests are what cover behaviour. It also needs the dev project awake: a
paused project fails at the sign-in step, and nothing about the failure will
say so.

It starts `next dev` itself unless one is already listening on port 3000, and
signs in as the end-to-end account from `apps/web/.env.test` — separate from
yours, so a run can never touch your Job Applications. The session is saved
once per run and reused, and every Job Application the test makes is deleted
afterwards, including any a failed run left behind. The first run on a machine
also needs a browser:

```sh
pnpm --filter web exec playwright install chromium
```

There are no component tests for the dashboard and no automated tests of the
side panel; both are out of scope for v1.

## Database

Postgres on Supabase, through Drizzle. The schema is
`apps/web/lib/db/schema.ts` and migrations live in `apps/web/drizzle/`:

```sh
pnpm --filter web db:generate   # write a migration for a schema change
pnpm --filter web db:migrate    # apply migrations to DIRECT_URL
```

Every query lives in a repository module under
`apps/web/lib/job-applications/` and takes the owner's user id as an argument
— nothing else in the app builds a query, which is the only thing keeping one
user's data away from another (ADR-0001).

## Auth

Sign-in is email and password against Supabase Auth. There is no sign-up page
and there won't be one — the single account is created by hand in the Supabase
dashboard (ADR-0001). `apps/web/proxy.ts` refreshes the session and redirects
signed-out traffic to `/sign-in`, so a page added under `apps/web/app` is
private unless it is named in `lib/auth/route-access.ts`.

The extension cannot hold that session, so it authenticates with a Personal
Access Token as a Bearer credential instead. Tokens are issued and revoked at
**/settings/tokens**, shown once, and stored only as a hash.

## Extension permissions

The manifest requests `storage`, `activeTab`, `scripting`, and `sidePanel` —
no broad host permissions. Extraction reads the active tab on demand via
`chrome.scripting.executeScript` when the user asks to save a Posting, rather
than through an always-on content script.

## Deployment

The web app is on Vercel at https://job-tracker-web-pi.vercel.app, against the
`job-tracker-prod` Supabase project. Pushing to `main` deploys; migrations are
applied by hand from a developer's machine, because there is no release step.
`docs/setup/deployment.md` has the environment variables, the migration
command and the curl commands that verify a deployment — including the one
that exercises CORS, Bearer authentication and the database in a single
request.

The extension is never deployed. It is loaded unpacked, which is why its
identity has to be pinned rather than left to Chrome.

## How this repo documents itself

- **[`CONTEXT.md`](CONTEXT.md)** — the glossary. Every domain term the code
  uses, and the synonyms to avoid. If you are naming something, check here
  first.
- **[`docs/adr/`](docs/adr/)** — the decision records, for choices whose
  reasons would otherwise be invisible: the multi-tenant schema under
  single-tenant operation (0001), a Posting's identity being its normalized
  URL (0002), and two cloud Supabase projects with no local stack (0003).
- **[`docs/setup/`](docs/setup/)** — `supabase.md` and `deployment.md`, the
  long forms of the steps above.
- **[`docs/agents/`](docs/agents/)** — how the agent skills consume all of the
  above.
- **`.scratch/`** — the issue tracker. Issues and specs live as local markdown
  rather than in a hosted tracker: one directory per feature
  (`.scratch/<feature-slug>/`), the spec at `spec.md`, and one file per ticket
  at `issues/<NN>-<slug>.md` carrying a `Status:` line. The convention is
  written down in `docs/agents/issue-tracker.md`. It is committed, so the
  reasoning behind a change is in the repository next to the change.

## Out of scope for v1

Named here so the gaps read as decisions rather than oversights: contacts and
recruiter tracking, follow-up reminders, status history, self-serve sign-up,
Row Level Security, a local Supabase stack, automatic merging of the same role
posted on two boards, confidence scores on extraction, file attachments,
skill-gap analysis, and Chrome Web Store, Firefox and Edge builds.
