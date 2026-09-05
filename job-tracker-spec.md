# Job Tracker — Technical Specification (v2)

## How to use this document

This is the spec for continuing implementation of the Job Tracker app in the
`job-tracker` Turborepo, which is already scaffolded on disk. Work through the
**Task List** in order — each phase depends on the ones before it. The **Out of
scope** section is deliberate: don't build those things unless asked.

Terminology is defined in [`CONTEXT.md`](./CONTEXT.md). Decisions that would
otherwise look arbitrary are recorded in [`docs/adr/`](./docs/adr/) and linked
from the relevant sections below — read the ADR before changing anything it
covers.

---

## 1. Overview

A personal job-application tracker with two surfaces:

1. A **web dashboard** for viewing, adding, and managing job applications.
2. A **Chrome extension** that reads the job posting on the page you're
   viewing, sends it to an LLM for structured extraction, and lets you review
   and save it in one click.

## 2. Current state (already scaffolded — do not redo)

```
job-tracker/
├── apps/
│   ├── web/                    # Next.js 16 (App Router) + Tailwind v4
│   │   └── app/page.tsx        # placeholder homepage, proves ui+schema wiring
│   └── extension/              # WXT (Manifest V3)
│       ├── wxt.config.ts       # permissions: storage, activeTab, scripting, sidePanel
│       ├── entrypoints/background.ts   # opens side panel on action click
│       └── entrypoints/sidepanel/      # side panel React app (placeholder content)
├── packages/
│   ├── schema/src/index.ts     # Zod schemas — the shared contract, see §5
│   └── ui/src/                 # card.tsx, status-badge.tsx (shared components)
└── turbo.json
```

Both apps build, lint, and type-check cleanly (`pnpm build` / `pnpm lint` /
`pnpm check-types` from the repo root). The extension has **no popup** — the
toolbar icon opens the side panel directly via
`browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`.

Versions on disk: Next 16.3.1, React 19.2.8, TypeScript 7.0.2, Node ≥24,
pnpm 11.22, WXT 0.21, Tailwind 4.3.

## 3. Tech stack

| Layer               | Choice                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------- |
| Monorepo            | Turborepo + pnpm                                                                       |
| Web app & API       | Next.js 16 (App Router), Route Handlers as the backend                                 |
| Extension           | WXT, Manifest V3, side panel (no popup)                                                |
| Shared UI           | `@repo/ui` — shadcn-style components + Tailwind v4                                     |
| Shared contract     | `@repo/schema` — Zod schemas **and** `normalizeJobUrl`                                 |
| Database            | Postgres via **Supabase** (two Free-plan projects — see ADR-0003)                      |
| ORM                 | Drizzle (`drizzle-orm/postgres-js`)                                                    |
| Auth                | Supabase Auth for the web app; a pasted Personal Access Token for the extension (§6.5) |
| LLM                 | Gemini Pro via `@google/genai`, structured output                                      |
| State/data fetching | TanStack Query                                                                         |
| Hosting             | Vercel                                                                                 |

## 4. Architecture & data flow

Both the web app and the extension talk **only** to the Next.js API in
`apps/web` — never directly to Gemini or the database. The LLM API key lives
server-side only.

The side panel runs on a `chrome-extension://` origin, so **every extension
call is cross-origin**. The API ships a shared CORS handler with an allowlist
containing the pinned extension origin and `http://localhost:3000`, plus
`OPTIONS` handlers on each route. `Authorization` must be in
`Access-Control-Allow-Headers`; credentials stay off, since the extension is
Bearer-only. The extension ID is pinned via `manifest.key` in `wxt.config.ts`
so it survives unpacked reloads.

Save-a-job flow:

1. User clicks the extension's toolbar icon → side panel opens.
2. The panel reads the active tab's URL and calls
   `GET /api/job-applications?url=<url>`. **If it's already saved**, the panel
   shows that Job Application with its status and no extraction runs.
3. Otherwise the user clicks "Save this job." The side panel asks the
   background script to run `chrome.scripting.executeScript` against the active
   tab, extracting the page's visible text (no static content script — this is
   on-demand, using the already-granted `activeTab` + `scripting` permissions).
4. Side panel POSTs `{ url, pageText }` to `/api/extract-job` (Bearer auth).
5. Backend calls Gemini with a response schema matching `JobExtraction` and
   returns an `ExtractJobResponse` (§6.4).
6. Side panel pre-fills a review form with the draft. User edits if needed,
   clicks Save.
7. Side panel POSTs the final object to `/api/job-applications` (same endpoint
   the web dashboard uses).

Extraction never runs on panel open — only on an explicit click — so opening
the panel on a non-job page costs nothing.

## 5. Data model

`packages/schema/src/index.ts` is the contract. **Phase 0 reshapes it** before
any database work, so the Drizzle schema mirrors the final contract rather than
an obsolete one:

- `jobUrl` becomes **nullable**. A Job Application can exist without a Posting
  (a referral, a recruiter email, a posting since taken down).
- `CreateJobApplication` makes every field optional except `company` and
  `jobTitle`. Previously every nullable field was _required but nullable_,
  forcing clients to send ten explicit `null`s. Omitted fields default to
  `null` server-side; omitted `status` defaults to `bookmarked`.
- Add `ExtractJobResponse` — a discriminated union, see §6.4.
- Add `normalizeJobUrl(url: string): string` — see ADR-0002. It lives here,
  not in a new package, because both apps must produce byte-identical output.

Tables in `apps/web`, all `snake_case`:

**`job_applications`** — mirrors `JobApplication` exactly, plus:

```
job_url_normalized  text          -- normalizeJobUrl(job_url), null when job_url is null
```

with a partial unique index on `(user_id, job_url_normalized) where
job_url_normalized is not null`.

**`api_tokens`**

```
api_tokens
  id            uuid primary key
  user_id       uuid not null       -- no FK to auth.users; see below
  name          text not null       -- e.g. "MacBook Chrome"
  token_hash    text not null       -- sha-256 of the raw token; raw shown once, never stored
  created_at    timestamptz not null default now()
  last_used_at  timestamptz
  revoked_at    timestamptz         -- soft revoke, so a leaked token leaves a trace
```

**`extraction_usage`**

```
extraction_usage
  user_id  uuid not null
  day      date not null
  count    integer not null default 0
  primary key (user_id, day)
```

`user_id` columns carry **no foreign key to `auth.users`**: Drizzle managing an
FK into a schema GoTrue owns and migrates is a recurring source of migration
failures, and tenant isolation is enforced in application code anyway
(ADR-0001).

`Contact` and `ActivityEvent` stay in `@repo/schema` for forward compatibility;
their tables and endpoints are out of scope (§7).

## 6. Feature requirements (v1)

### 6.1 Database & Auth

- Two Supabase Free-plan projects, `job-tracker-dev` and `job-tracker-prod`
  (ADR-0003). No local Supabase stack.
- Drizzle over `postgres-js`. The app connects on the **pooled** URL with
  `prepare: false`; `drizzle.config.ts` uses the **direct** URL, because the
  transaction pooler doesn't support the session-level DDL migrations need.
- Supabase Auth: **sign-in page only**. No self-serve sign-up — the account is
  created in the Supabase dashboard (ADR-0001). No Row Level Security.
- `requireUser()` helper resolving the current user in a Route Handler from
  either (a) the Supabase session cookie, or (b) an `Authorization: Bearer
<token>` header matched against `api_tokens.token_hash` where
  `revoked_at is null`, updating `last_used_at` on success.
- Every database query lives in a repository module taking `user_id` as a
  non-optional argument. No route handler builds a query inline — this is the
  only thing standing between users' data (ADR-0001).

### 6.2 Backend API (`apps/web/app/api/...`)

- `POST /api/job-applications` — create, validated with `CreateJobApplication`.
  Computes `job_url_normalized`.
- `GET /api/job-applications` — list current user's applications; optional
  `?status=` and `?url=` (normalized before lookup) filters.
- `GET /api/job-applications/[id]`
- `PATCH /api/job-applications/[id]` — update, validated with
  `UpdateJobApplication`. **This is also how status changes happen** — there is
  no separate status endpoint; two paths would need identical ownership checks
  and identical `appliedAt` logic and would drift.
- `DELETE /api/job-applications/[id]`
- `GET /api/tokens` — list (id, name, created_at, last_used_at); never the hash.
- `POST /api/tokens` — issue a token, returning the raw value once.
- `DELETE /api/tokens/[id]` — soft revoke.
- `POST /api/extract-job` — §6.4.
- Every endpoint scoped by `user_id`; every endpoint has an `OPTIONS` handler
  and CORS headers from the shared helper.

**Status side effect:** when a `PATCH` moves `status` to `applied` and
`applied_at` is currently null, set `applied_at = now()`. Never clear it on a
move backwards — you did apply, and `withdrawn` shouldn't erase that.
`appliedAt` is also directly editable on the detail view, for backfilling.

### 6.3 Web dashboard (`apps/web`)

- Sign-in page (no sign-up).
- Kanban board grouped by `JobStatus`, cards using `@repo/ui`'s `StatusBadge`,
  showing company, title, applied date.
- The board fetches **all** the user's applications under a single TanStack
  Query key (`['job-applications']`) and groups client-side. Status changes are
  optimistic: `onMutate` snapshots, `onError` rolls back and shows a toast with
  a retry action, `onSettled` invalidates.
- Search and filtering (company, title, status) happen **client-side** against
  that one cached list — for a personal tracker this is hundreds of rows, so
  there's no debounce, no spinner, and no second cache to disagree with the
  board.
- List/table view as an alternative to kanban; the choice persists in
  `localStorage`.
- "Add job" manual form, validated client-side with `CreateJobApplication`
  (react-hook-form + the Zod resolver).
- Job detail view: edit any field, delete the job.
- Settings page: list tokens, generate a new one (shown once, with a copy
  button), revoke existing ones.

### 6.4 LLM extraction endpoint

- `GEMINI_API_KEY` as a server-only env var; `@google/genai` as the SDK.
- Model pinned in a single exported constant (`gemini-2.5-pro` — confirm the
  exact current ID in AI Studio before implementing).
- `POST /api/extract-job` accepts `{ url: string, pageText: string }`.
- Truncate `pageText` to ~30,000 characters from the **front** of the document,
  where the posting body reliably lives.
- Response schema derived from `JobExtraction`. The schema is flat, which
  matters: Gemini supports only a subset of JSON Schema and can reject deeply
  nested schemas.
- Returns `ExtractJobResponse`:
  - `{ ok: true, draft: JobExtraction }`
  - `{ ok: false, reason: "no_job_found" | "provider_error" }` with HTTP 200 —
    the side panel falls back to manual entry rather than breaking.
  - `{ ok: false, reason: "rate_limited" }` with HTTP **429** — this one isn't
    a fallback case, it's "wait".
  - A bare `JobExtraction` is never returned, because `{}` is indistinguishable
    from a successful extraction of a page with no job on it.
  - `no_job_found` means `company` and `jobTitle` both came back empty. There
    is no confidence score anywhere — the model can't calibrate one.
- If Gemini Pro returns a quota error, surface `provider_error`. Do **not**
  silently fall back to a cheaper model — a visible failure is how you learn
  the grant is exhausted.
- Rate limit: 100 extractions per user per day, via an upsert on
  `extraction_usage` in the same request. High enough never to hit in personal
  use, low enough to matter if a token leaks.

### 6.5 Chrome extension (`apps/extension`)

The side panel is a **fixed shell**, not a state machine that swaps screens:

- Header: link to the web dashboard.
- Primary action area, context-sensitive:
  - no token stored → token + API base URL setup form
    (`chrome.storage.local`);
  - current tab already saved → that Job Application's company, title and
    status, with a status control. No extraction, no re-extract escape hatch —
    edits happen in the dashboard.
  - otherwise → "Save this job" button.
- "Add manually" as a secondary link beneath the primary action, in all states,
  opening the review form with empty fields.
- Recent jobs list (`GET /api/job-applications`, last 5) below.
- The review form replaces the panel contents; cancel returns to the default.
- When a save would duplicate a Posting at a company where a similar title
  already exists, show a **non-blocking hint** ("you already have an
  application at Stripe for a similar title"). Never merge automatically
  (ADR-0002).
- Default API base URL comes from a WXT build-time var (`WXT_API_BASE_URL`), so
  dev builds point at localhost and production builds at Vercel; the settings
  field overrides it.

### 6.6 Polish (keep light for v1)

- Loading, empty, and error states on both dashboard and side panel.
- One Playwright smoke test: sign in → manually add a job → change its status →
  confirm it persists on reload. It runs against `localhost:3000` pointed at
  the **dev** project, signs in through the real form once with credentials
  from `.env.test`, saves `storageState` for reuse, and cleans up the job it
  creates in `afterEach`.
- Update the root `README.md` with §8's env vars and setup steps.

## 7. Out of scope for v1 (deliberately deferred)

- Contacts / recruiter tracking (schema exists, no table/UI yet)
- Follow-up reminders or notifications (`ActivityEvent` exists, no table/UI yet)
- Status history — nothing records past transitions
- Self-serve sign-up and Row Level Security (ADR-0001)
- A local Supabase stack (ADR-0003)
- Automatic merging of the same job posted on two boards (ADR-0002)
- Confidence scores on extraction
- Resume/cover-letter attachments and file storage
- Analytics or keyword-gap analysis
- Chrome Web Store submission assets
- Firefox/Edge builds
- `chrome.identity`-based OAuth for the extension

## 8. Environment variables

Per environment — `.env.local` points at the dev project, Vercel's environment
at prod:

```
DATABASE_URL=                        # Supabase POOLED connection (6543), app runtime, prepare:false
DIRECT_URL=                          # Supabase DIRECT connection (5432), drizzle-kit only
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GEMINI_API_KEY=                      # server-only, used only in /api/extract-job
```

`.env.test` (gitignored):

```
E2E_EMAIL=
E2E_PASSWORD=
```

The extension has no runtime env vars — the token and API base URL live in
`chrome.storage.local`. `WXT_API_BASE_URL` is build-time only.

There is no `SUPABASE_SERVICE_ROLE_KEY`: Drizzle connects over `DATABASE_URL`
as the database owner, so nothing needs it.

---

## Task list

### Phase 0 — Contract

- [ ] `@repo/schema`: make `jobUrl` nullable
- [ ] `@repo/schema`: `CreateJobApplication` optional except `company` + `jobTitle`
- [ ] `@repo/schema`: add `ExtractJobResponse`
- [ ] `@repo/schema`: add `normalizeJobUrl`
- [ ] One commit, nothing else — the Drizzle schema depends on this being final

### Phase 1 — Database & Auth

- [ ] Create `job-tracker-dev` and `job-tracker-prod` Supabase projects; capture keys
- [ ] Create the account by hand in each project's dashboard
- [ ] Add Drizzle to `apps/web`; `drizzle.config.ts` on `DIRECT_URL`
- [ ] Drizzle schema: `job_applications` (+ `job_url_normalized` + partial unique index), `api_tokens`, `extraction_usage`
- [ ] Generate and run the initial migration against dev
- [ ] Supabase Auth sign-in page
- [ ] `requireUser()` helper (session cookie or Bearer token)
- [ ] Repository module — every query takes `user_id`

### Phase 2 — Backend API

- [ ] Shared CORS helper + `OPTIONS` handlers
- [ ] `POST /api/job-applications`
- [ ] `GET /api/job-applications` (+ `?status=`, `?url=`)
- [ ] `GET /api/job-applications/[id]`
- [ ] `PATCH /api/job-applications/[id]` (incl. `appliedAt` side effect)
- [ ] `DELETE /api/job-applications/[id]`
- [ ] `GET` / `POST` / `DELETE` `/api/tokens`

### Phase 2.5 — Deploy

- [ ] Deploy `apps/web` to Vercel against the prod project
- [ ] Pin the extension ID (`manifest.key` in `wxt.config.ts`)
- [ ] Add both origins to the CORS allowlist and verify a Bearer call end-to-end

### Phase 3 — Web dashboard

- [ ] Kanban board, single query key, client-side grouping
- [ ] Optimistic status changes with rollback + retry toast
- [ ] "Add job" manual form
- [ ] Job detail view (edit / delete)
- [ ] List/table view toggle, persisted in `localStorage`
- [ ] Client-side search/filter
- [ ] Settings page: token list / generation / revocation

### Phase 4 — LLM extraction

- [ ] `POST /api/extract-job` with Gemini structured output
- [ ] Truncation + `ExtractJobResponse` failure shapes
- [ ] Per-user daily rate limit via `extraction_usage`

### Phase 5 — Extension wiring

- [ ] Fixed side-panel shell (header link, primary action, manual add, recent jobs)
- [ ] First-run token + base URL setup, `WXT_API_BASE_URL` default
- [ ] Already-saved lookup via `?url=` on panel open
- [ ] On-demand extraction via `chrome.scripting.executeScript`
- [ ] "Save this job" → extract → review form → save
- [ ] Manual-entry fallback
- [ ] Similar-application hint

### Phase 6 — Polish

- [ ] Loading/empty/error states
- [ ] Playwright smoke test (dev project, seeded account, `storageState`)
- [ ] Update root `README.md`

## Definition of done for v1

- Can sign in to the web app.
- Can manually add a job application — with or without a URL — and see it on
  the kanban board.
- Can change a job's status and see it persist across reloads, with the move
  rolling back visibly if the request fails.
- Can open the extension's side panel on a job posting, click "Save this job,"
  see a Gemini-generated draft, edit it, save it — and see it appear on the
  dashboard.
- Opening the panel on a posting already saved shows the existing application
  instead of extracting again.
- All data persists in Supabase Postgres across sessions and devices.
