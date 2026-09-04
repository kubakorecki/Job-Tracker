# Deployment

`apps/web` — the dashboard and the API it serves — is deployed on Vercel at
https://job-tracker-web-pi.vercel.app and talks to the `job-tracker-prod`
Supabase project (ADR-0003). The extension is never deployed: it is loaded
unpacked from `apps/extension/.output/chrome-mv3`, which is why its identity
has to be pinned rather than left to Chrome (see below).

The deploy happens this early on purpose. The extension reaches the API
cross-origin from a `chrome-extension://` origin, and a connection string or a
CORS allowlist that is wrong is far cheaper to find against the eight endpoints
in `apps/web/app/api` than against a finished app.

## The Vercel project

Created from this repository with Vercel's own framework detection and left
there: nothing overrides the install, build or output settings. Pushing to the
project's production branch — `main` — deploys.

## Environment variables

Set in **Project Settings → Environment Variables**, for Production. They are
the same seven names as `apps/web/.env.example`, pointing at `job-tracker-prod`
rather than `job-tracker-dev`:

| Variable                        | Value in production                                   |
| ------------------------------- | ----------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | the prod project's URL                                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the prod project's anon key                           |
| `DATABASE_URL`                  | prod **transaction pooler**, port 6543                |
| `DIRECT_URL`                    | prod **session pooler**, port 5432                    |
| `EXTENSION_ORIGIN`              | `chrome-extension://okeljopaafaojopfkhjioaceeohjplhb` |
| `GEMINI_API_KEY`                | the AI Studio developer key extraction calls          |
| `SUPABASE_SERVICE_ROLE_KEY`     | the prod project's service_role key                   |

Five things about that list are load-bearing:

- **The runtime connects through the pooler and never prepares a statement.**
  `DATABASE_URL` is the transaction pooler because a serverless function is a
  process per request and would otherwise open a Postgres connection per
  request. That pooler hands each statement to whichever backend is free, so
  `lib/db/client.ts` passes `prepare: false` — a prepared statement would never
  be found on the connection that prepared it. The same file strips
  `pgbouncer=true`, which the Supabase dashboard prints on the pooled URL but
  postgres.js forwards to the server as an unknown startup option.
- **`DIRECT_URL` is never read by the deployment.** Migrations run from a
  developer's machine, below, so nothing in a serverless function ever opens
  that connection. It is set all the same: leaving one of the seven names blank
  in production invites the next person to wonder which environment is missing
  what.
- **`GEMINI_API_KEY` is the one name with no Supabase equivalent.** Dev and
  production may share the same key; nothing about it is per-environment. It
  is read lazily by the extraction endpoint alone, so a deployment missing it
  serves the dashboard perfectly and fails only when the panel asks for a
  Draft — which is the failure the panel already knows how to survive.
- **`SUPABASE_SERVICE_ROLE_KEY` is the one secret that grants everything.**
  The Profile's CV store reads it, and nothing else does: Supabase Storage puts
  every object behind Row Level Security and this schema has no policies
  (ADR-0001), so it is what makes the private `cvs` bucket reachable. It must
  never be given the `NEXT_PUBLIC_` prefix, which would inline it into the
  browser bundle. The bucket itself is created by hand, once per project
  (docs/setup/supabase.md).
- **A change needs a redeploy.** `NEXT_PUBLIC_*` is inlined into the browser
  bundle at build time, and a deployment's server environment is fixed when it
  is built, so editing a variable in the dashboard changes nothing until the
  next deploy.

## Migrations

The deployment does not migrate itself — there is no release step and no
migration container. `apps/web/drizzle/` is applied by hand over the direct
connection, from a machine holding the prod credentials in `apps/web/.env.prod`
(gitignored, like every other `.env` file here):

```sh
set -a && . apps/web/.env.prod && set +a && pnpm --filter web db:migrate
```

`DIRECT_URL` from that file wins over the one in `.env.local`: the tooling
loads `.env.local` with `process.loadEnvFile`, which does not overwrite a
variable already in the environment. The direct connection is what migrations
need — the transaction pooler cannot run the session-level DDL of `CREATE TYPE`
and friends (ADR-0003).

## The extension's identity

An unpacked extension with no `key` in its manifest gets an id derived from the
directory it was loaded from, so a moved checkout or a second machine is a new
`chrome-extension://` origin — and an allowlist that names the old one is
silently wrong. `apps/extension/wxt.config.ts` therefore commits the public half
of an RSA key, which fixes the id at:

```
chrome-extension://okeljopaafaojopfkhjioaceeohjplhb
```

Because the key is committed, this is a constant of the repository rather than
a per-machine fact: it is the value of `EXTENSION_ORIGIN` everywhere, in
`.env.local` and in the deployment alike. To confirm the manifest and the
allowlist still agree:

```sh
grep -o "key: '[^']*'" apps/extension/wxt.config.ts | sed "s/key: '//; s/'$//" \
  | base64 -d | openssl dgst -sha256 -hex | awk '{print $2}' \
  | cut -c1-32 | tr '0-9a-f' 'a-p'
```

The private half signs a `.crx` and nothing in v1 packs one, so it is not
committed; it sits ignored at `apps/extension/.keys/extension.pem`. A Chrome
Web Store build would be signed with the store's key and would be a different
extension with a different id — `EXTENSION_ORIGIN` takes a comma-separated list
so both can be allowed at once.

## Verifying a deployment

The four things worth checking after a deploy, none of which need a browser.
The first three need no credential at all:

```sh
APP=https://job-tracker-web-pi.vercel.app
EXTENSION=chrome-extension://okeljopaafaojopfkhjioaceeohjplhb

# Signed out, the dashboard sends you to /sign-in.
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "$APP/"

# The extension's preflight: 204, allowed back by name, and told it may send
# `authorization` — with no `access-control-allow-credentials` anywhere.
curl -s -i -X OPTIONS "$APP/api/job-applications" \
  -H "origin: $EXTENSION" \
  -H 'access-control-request-method: GET' \
  -H 'access-control-request-headers: authorization'

# Any other origin: 403, and no permission attached.
curl -s -o /dev/null -w '%{http_code}\n' -X OPTIONS "$APP/api/job-applications" \
  -H 'origin: https://not-the-extension.test' \
  -H 'access-control-request-method: GET'
```

The fourth is the one that proves the whole path — CORS, Bearer authentication
and the prod database in one request. Generate a Personal Access Token on the
deployed app (**/settings/tokens**, after signing in as the prod account) and:

```sh
curl -s -i "$APP/api/job-applications" \
  -H "origin: $EXTENSION" \
  -H "authorization: Bearer $TOKEN"
```

A 200 carrying `access-control-allow-origin: <the extension>` means the
deployment is reachable exactly as the side panel will reach it. A 401 means
the token is wrong or revoked; a 500 usually means the migrations above have
not been applied to the prod project.

## When it stops responding

Free Supabase projects pause after a week of inactivity, and production is by
nature the less-used of the two. A paused project fails every request; unpausing
is one button in the Supabase dashboard. This is the accepted cost of not
running a local stack — see ADR-0003 and `docs/setup/supabase.md`.
