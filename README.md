# Job Tracker

A Turborepo monorepo for tracking job applications: a Next.js web dashboard and
a Chrome extension that reads job postings and pre-fills an entry using the
Claude API.

## Apps and packages

- `apps/web` — Next.js dashboard (App Router, Tailwind v4). Will host both the
  UI and the backend API route handlers.
- `apps/extension` — Chrome extension (Manifest V3, built with [WXT](https://wxt.dev)).
  A side panel with no popup — the toolbar icon opens it directly. It asks for
  a Personal Access Token and an API base URL on first run, and lists the most
  recent Job Applications afterwards.
- `packages/schema` — Zod schemas (`JobApplication`, `Contact`,
  `ActivityEvent`, ...). The single source of truth for data shapes, consumed
  by both apps.
- `packages/ui` — Shared React components (`Card`, `StatusBadge`, ...) built
  with Tailwind v4, consumed by both `web` and the extension's side panel.
- `packages/eslint-config`, `packages/typescript-config`, `packages/tailwind-config` —
  shared tooling config.

## Getting started

```sh
pnpm install
pnpm dev      # runs web + extension in watch mode
```

- Web app: http://localhost:3000
- Extension dev server: http://localhost:3001 — pinned in `wxt.config.ts` so it
  cannot land on the web app's port, where both servers would answer and a
  browser would reach whichever address it resolved first.
- Extension: `pnpm --filter extension dev` opens a Chrome instance with the
  extension pre-loaded (WXT's dev server). To load it manually instead:
  `chrome://extensions` → enable Developer Mode → "Load unpacked" →
  `apps/extension/.output/chrome-mv3`.
- The extension's id is pinned by a public key in its manifest, so it is
  `okeljopaafaojopfkhjioaceeohjplhb` wherever this repository is built rather
  than something Chrome invents per checkout. That is what the API's CORS
  allowlist trusts, as `EXTENSION_ORIGIN`.

Other useful commands, run from the repo root:

```sh
pnpm build         # build all apps and packages
pnpm lint          # lint all apps and packages
pnpm check-types   # type-check all apps and packages
pnpm test          # run every workspace's tests
pnpm test:e2e      # run the Playwright smoke test
```

The web app's API tests talk to the dev Supabase project, so they need
`apps/web/.env.local` filled in and the project unpaused (ADR-0003). They run
serially, create the rows they need, and delete them afterwards.

`pnpm test:e2e` is one Playwright test — sign in, add a Job Application, change
its Status, reload, confirm it persisted — and it is not in `pnpm test`, since
it needs a browser and a running dev server. It exists to prove the dashboard,
the API and the database are wired together at all; the API tests are what
cover behaviour. It also needs the dev project awake: a paused project fails
the sign-in step, and nothing about the failure will say so.

It starts `next dev` itself unless one is already listening on port 3000, and
signs in as an account of its own — separate from yours, so a run can never
touch your Job Applications. Put that account's credentials in
`apps/web/.env.test` (copy `apps/web/.env.test.example`); the session is saved
once per run and reused, and every Job Application the test makes is deleted
afterwards, including any a failed run left behind. The first run on a machine
also needs a browser: `pnpm --filter web exec playwright install chromium`.

## Extension permissions

The manifest only requests `storage`, `activeTab`, `scripting`, and
`sidePanel` — no broad host permissions. The plan is for job-posting
extraction to run on demand via `chrome.scripting.executeScript` against the
active tab when the user opens the side panel, rather than an always-on
content script. That extraction endpoint isn't wired up yet — this is just
the scaffold.

## Database

Postgres on Supabase, through Drizzle. The schema is
`apps/web/lib/db/schema.ts` and migrations live in `apps/web/drizzle/`:

```sh
pnpm --filter web db:generate   # write a migration for a schema change
pnpm --filter web db:migrate    # apply migrations to DIRECT_URL
```

Every query lives in a repository module under `apps/web/lib/job-applications/` and takes
the owner's user id as an argument — nothing else in the app builds a query,
which is the only thing keeping one user's data away from another (ADR-0001).

## Auth

Sign-in is email and password against Supabase Auth. There is no sign-up page
and there won't be one — the single account is created by hand in the Supabase
dashboard (ADR-0001). `apps/web/proxy.ts` refreshes the session and redirects
signed-out traffic to `/sign-in`, so a page added under `apps/web/app` is
private unless it is named in `lib/auth/route-access.ts`.

Development and production each run against their own cloud Supabase project
and there is no local stack (ADR-0003). Copy `apps/web/.env.example` to
`apps/web/.env.local` before `pnpm dev`; see `docs/setup/supabase.md` for
where each value lives in the dashboard.

## Deployment

The web app is on Vercel at https://job-tracker-web-pi.vercel.app, against the
`job-tracker-prod` Supabase project. Pushing to `main` deploys; migrations are
applied by hand from a developer's machine, because there is no release step.
`docs/setup/deployment.md` has the environment variables, the migration command
and the curl commands that verify a deployment — including the one that
exercises CORS, Bearer authentication and the database in a single request.

## Not set up yet

- The LLM extraction endpoint and its call from the extension
- The side panel itself: saving the current Posting, and recognising one
  already saved

See the project plan for the phased build-out of these.
