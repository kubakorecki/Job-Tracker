# 07: Generate a Personal Access Token and call the API with it

**What to build:** The user can issue a named credential in the dashboard and use it to reach their own data from outside the browser session — which is how the extension will authenticate. Revoking it takes effect immediately.

**Blocked by:** 03

**Status:** ready-for-agent

- [x] A Personal Access Tokens table stores a name, a SHA-256 hash of the token, creation time, last-used time and a nullable revocation time
- [x] The raw token value is shown exactly once on creation, with a copy button, and is never recoverable afterwards
- [x] Each token is named, so one machine's token is distinguishable from another's
- [x] A settings page lists tokens with their name, creation time and last-used time, and never exposes the hash
- [x] A token can be revoked; revocation is soft, so the row survives as a trace
- [x] The current-user resolver accepts a Bearer token as an alternative to the session cookie
- [x] A revoked token is rejected immediately on the next request
- [x] A successful Bearer request updates that token's last-used time
- [x] Every endpoint carries CORS headers from one shared layer, with preflight handled, the authorization header permitted, and credentials off
- [x] The allowlist covers the extension origin and the local development origin; other origins are refused
- [x] Tests authenticate with a Bearer token rather than a session, proving the whole API is reachable without the auth service

## Comments

Implemented in `apps/web`:

- `lib/db/schema.ts` gained `personal_access_tokens`: a name, a SHA-256 hash of
  the raw value (unique, because authentication looks a token up by it alone),
  creation time, nullable last-used time and nullable revocation time. Migration
  `0001_empty_longshot.sql`, applied to the dev project.
- `lib/personal-access-tokens/` mirrors the layout `lib/job-applications/`
  established: `token.ts` mints and hashes the credential and reads it off a
  request, `repository.ts` holds every query, `api.ts` holds the endpoints as
  plain request-to-response functions, `contract.ts` is the shape a client sees,
  `client.ts` is how the browser addresses it.
- `lib/auth/current-user.ts` now takes an optional `Request`. A Bearer token is
  answered on the token alone; anything else falls through to the session
  cookie. A page rendering on the server passes no request and so has no token
  to offer, which is why `getCurrentUser()` still reads as it did.
- `lib/api/cors.ts` is the shared layer. `authenticatedRoute` puts the headers on
  every response it returns — the 401 included — and each `route.ts` re-exports
  `OPTIONS` from it for the preflight. Credentials are never allowed.
- `/settings/tokens` issues a token, shows the raw value once with a copy button
  and the warning attached, lists name/created/last-used, and revokes behind a
  confirm. Linked from the dashboard header.

Decisions worth knowing about:

- **Token management needs the session, not a token** (`sessionRoute` in
  `lib/api/authenticated-route.ts`). Wrapping these three endpoints in the
  ordinary `authenticatedRoute` let a stolen token mint its own replacement and
  revoke the tokens the user knew about — which would have made revocation
  ceremonial. The stricter wrapper is the same resolver asked without a request,
  so the `Authorization` header is simply unreadable there. Found on review.
- **The token contract is local, not `@repo/schema`.** The extension only ever
  holds the raw string a user pasted into it; the dashboard is the only surface
  that issues, lists or revokes one. Nothing shared, so nothing in the shared
  contract.
- **Authentication is one statement**, not a read then a write: the update
  matches on hash and `revoked_at is null`, stamps last-used and returns the
  owner. There is no window for a token to be revoked between the check and the
  stamp. It is the one repository function that does not take `user_id` first,
  because it is the query that _establishes_ it — ADR-0001's Consequences now
  records that exception rather than leaving it to a code comment.
- **Last-used is stamped when the token authenticates**, not when the request
  goes on to succeed. The purpose is spotting tokens no longer in use, and a
  token being used against an endpoint that then 404s is still a token in use.
- **An origin that is not on the allowlist is refused at the preflight** (403)
  and gets no `Access-Control-Allow-Origin` on anything else, which is what
  makes a browser withhold the response. Simple cross-origin requests are not
  rejected outright: credentials are off and every endpoint demands one, so an
  unlisted origin can do nothing without a stolen token — and rejecting on the
  `Origin` header would refuse the deployed dashboard's own writes.
- **The local development origin is allowed only outside a deployment.** In
  production the dashboard is same-origin and has no use for CORS, so
  `http://localhost:3000` there would be an allowance with no beneficiary but a
  stranger. The extension's own origin comes from `EXTENSION_ORIGIN`, which
  ticket 08 pins.
- **`deletePersonalAccessToken` hard-deletes**, and exists for the same reason
  `deleteJobApplication` did in ticket 03: revocation is soft by design, so a
  test that only revoked would leave a row behind on every run.
- Three pieces of already-shipped code moved rather than being copied, because
  the settings page needed them: `lib/api/client.ts` (out of
  `job-applications/client.ts`), `lib/day.ts` (out of `applied-date.ts`), and
  `app/dashboard/form.tsx` → `app/form.tsx`. `lib/api/request.ts` is the JSON
  body reader the endpoints had three copies of.

Reviewed on both axes afterwards. Acted on: the privilege escalation above; the
local origin gated out of production; a dead `revokedAt ?? createdAt` fallback
in the settings table that would have labelled a creation date as a revocation
date; the JSON-body duplication; the dynamic import of the Supabase client,
which was the only one in the app and bought nothing a static import does not;
`bearing` renamed to `presenting`, one letter from test-support's `bearer`; the
ADR amendment. Left alone deliberately: `notFound()` and the id predicate are a
line each per resource and each cites its own contract; last-used renders as a
day, like every other date the dashboard shows.

Verified against the live dev project: 124 tests pass serially and leave no rows
behind, with every Job Applications test now reaching the endpoints through
`authenticatedRoute` carrying a Bearer token — no session, no auth service.
Typecheck, lint and build clean. Against a running server: a preflight from the
extension origin is a 204 permitting `authorization` with no
`allow-credentials`; from an unlisted origin, a 403; a Bearer `GET
/api/job-applications` is a 200; no credential is a 401 still carrying CORS
headers; and a Bearer token is refused 401 by all three token-management
endpoints while the same token still reads Job Applications.

**Still needs a human**: issuing a token through the settings page in a browser,
which needs the dev account's password — the copy button and the once-only
display are the parts no test covers.
