# Supabase setup

Two cloud projects, no local stack (ADR-0003). Everything here is done by hand
in the Supabase dashboard — none of it is scripted, because it happens twice
ever.

## 1. Create the two projects

In one Supabase organisation on the Free plan, create:

| Project            | Used by                                              |
| ------------------ | ---------------------------------------------------- |
| `job-tracker-dev`  | local development, the API tests, the Playwright run |
| `job-tracker-prod` | the deployed app                                     |

The Free plan allows exactly two active projects per organisation, which is why
there is no third. Note each project's database password when you create it —
the dashboard does not show it again.

## 2. Create the account by hand

There is no sign-up page and there will not be one (ADR-0001). In each project:

**Authentication → Users → Add user → Create new user**, then give it an email
and password and tick _Auto Confirm User_ (without it, sign-in fails with
"email address hasn't been confirmed").

For the dev project, create two separate users, so neither run disturbs the
other:

| User               | Belongs to                            |
| ------------------ | ------------------------------------- |
| your own address   | hands-on development                  |
| an end-to-end user | the Playwright smoke test (ticket 13) |

The API test suite needs no account at all. No table carries a foreign key into
the auth schema, so its two users are fixed identifiers in
`apps/web/lib/test-support/users.ts` rather than sessions — which is also why
they can never collide with the account you just made.

## 3. Fill in the environment file

```sh
cp apps/web/.env.example apps/web/.env.local
```

`apps/web/.env.example` names where each value lives in the dashboard. For
production the same five variables are set in the deployment's environment
rather than in a file, pointing at `job-tracker-prod`.

Take both database URLs from the dashboard's **Connect** panel, and take the
**pooler** ones: `DATABASE_URL` is the transaction pooler on port 6543, and
`DIRECT_URL` is the session pooler on port 5432. The "Direct connection" the
panel offers alongside them — `db.<ref>.supabase.co` — resolves to IPv6 only,
and a machine with no IPv6 route cannot reach it at all: every query fails with
`ENOTFOUND`. The session pooler is the same connection over IPv4 and does run
the session-level DDL that migrations need.

## 4. Create the tables

```sh
pnpm --filter web db:migrate
```

This applies `apps/web/drizzle/` over `DIRECT_URL`. Do it for the production
project too, with that project's URL in the environment. Changing the schema
means editing `apps/web/lib/db/schema.ts` and running
`pnpm --filter web db:generate` to write the next migration.

## 5. Sign in

```sh
pnpm dev
```

Open http://localhost:3000. Signed out, it redirects to `/sign-in`; signing in
with the account from step 2 lands on `/dashboard`.

## When it stops responding

Free projects pause after a week of inactivity, and a paused project makes
every request fail — the app, the API tests and the Playwright run alike.
Unpausing is one button in the dashboard. This is the accepted cost of not
running a local stack; see ADR-0003.
