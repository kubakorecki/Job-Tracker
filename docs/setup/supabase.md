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

For the dev project, create three separate users, so no run can disturb
another:

| User               | Belongs to                             |
| ------------------ | -------------------------------------- |
| your own address   | hands-on development                   |
| an API-test user   | the API test suite (ticket 03 onwards) |
| an end-to-end user | the Playwright smoke test (ticket 13)  |

## 3. Fill in the environment file

```sh
cp apps/web/.env.example apps/web/.env.local
```

`apps/web/.env.example` names where each value lives in the dashboard. For
production the same four variables are set in the deployment's environment
rather than in a file, pointing at `job-tracker-prod`.

Both the pooled and the direct database URL are recorded even though nothing
reads them yet — the tables arrive in ticket 03, and having them in place is
part of this ticket's definition of done.

## 4. Sign in

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
