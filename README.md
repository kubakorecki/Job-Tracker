# Job Tracker

A Turborepo monorepo for tracking job applications: a Next.js web dashboard and
a Chrome extension that reads job postings and pre-fills an entry using the
Claude API.

## Apps and packages

- `apps/web` — Next.js dashboard (App Router, Tailwind v4). Will host both the
  UI and the backend API route handlers.
- `apps/extension` — Chrome extension (Manifest V3, built with [WXT](https://wxt.dev)).
  Currently a side panel scaffold with no popup — the toolbar icon opens the
  side panel directly.
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
- Extension: `pnpm --filter extension dev` opens a Chrome instance with the
  extension pre-loaded (WXT's dev server). To load it manually instead:
  `chrome://extensions` → enable Developer Mode → "Load unpacked" →
  `apps/extension/.output/chrome-mv3`.

Other useful commands, run from the repo root:

```sh
pnpm build         # build all apps and packages
pnpm lint          # lint all apps and packages
pnpm check-types   # type-check all apps and packages
pnpm test          # run every workspace's tests
```

## Extension permissions

The manifest only requests `storage`, `activeTab`, `scripting`, and
`sidePanel` — no broad host permissions. The plan is for job-posting
extraction to run on demand via `chrome.scripting.executeScript` against the
active tab when the user opens the side panel, rather than an always-on
content script. That extraction endpoint isn't wired up yet — this is just
the scaffold.

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

## Not set up yet

- Database (Postgres) + Drizzle ORM
- API route handlers (CRUD on job applications)
- The LLM extraction endpoint and its call from the extension
- The actual dashboard UI (kanban/list views, forms)

See the project plan for the phased build-out of these.
