# 08: Deploy to Vercel and pin the extension ID

**What to build:** The API runs live against the production project, and the extension has a stable identity the CORS allowlist can trust. Deploying now means connection and CORS problems surface against a handful of endpoints rather than a finished app.

**Blocked by:** 07

**Status:** ready-for-agent

- [x] The web app is deployed to Vercel against the prod Supabase project
- [x] Production environment variables are set, with the pooled connection used at runtime and prepared statements disabled
- [x] Migrations have been applied to the prod project using the direct connection
- [x] The extension's ID is pinned in its manifest so it survives unpacked reloads
- [ ] Both the pinned extension origin and the local development origin are in the deployed allowlist — the extension origin is; the local origin stays out of a deployment on purpose, and this box stays unticked until someone decides which of the two is wrong (see below)
- [x] A Bearer-authenticated request from the extension origin succeeds against production, including its preflight
- [x] Signing in and listing Job Applications works against the deployed app

## Comments

The deployment is https://job-tracker-web-pi.vercel.app, serving `apps/web`
against the `job-tracker-prod` Supabase project. Everything in the repository
that the deploy needed:

- `apps/extension/wxt.config.ts` gained a `key`: the public half of an RSA
  keypair, which fixes the extension's id at
  `chrome-extension://okeljopaafaojopfkhjioaceeohjplhb`. Without one, Chrome
  derives an unpacked extension's id from the directory it was loaded from, so a
  moved checkout or a second machine is a new origin and the allowlist is
  silently wrong.
- `apps/web/.env.example` now carries that origin as the value of
  `EXTENSION_ORIGIN` rather than an empty string, and `docs/setup/deployment.md`
  is new: the environment variables, the migration command, the derivation of the
  id, and the curl commands that verify a deployment without a browser. The
  README points at it.
- Two neighbouring documents were stale and are now not: `docs/setup/supabase.md`
  said the deployment sets "the same four variables" when the fifth is the one
  this ticket added, and the README's "Not set up yet" list still promised
  endpoints, Personal Access Tokens and the dashboard views that tickets 03-07
  shipped. Ticket 15 rewrites the README properly; this is only the part that
  had gone false directly above the section being added.

Decisions worth knowing about:

- **The pinned id is a constant of the repository, not a per-machine fact.**
  Because the public key is committed, every build of this repo is the same
  extension, so `EXTENSION_ORIGIN` is the same literal string in `.env.local`
  and in the deployment. This is why the value sits in `.env.example` as a
  default rather than as a placeholder to fill in. The variable stays a variable
  because a Chrome Web Store build is signed with the store's key and would be a
  different extension — the allowlist takes a comma-separated list for exactly
  that.
- **The private half is not committed.** It signs a `.crx` and nothing in v1
  packs one; it sits ignored at `apps/extension/.keys/extension.pem`. Losing it
  costs nothing today, because the id an unpacked load derives comes from the
  public key alone.
- **The local development origin is still refused in production**, which is
  where this ticket's fifth criterion and ticket 07's shipped behaviour
  disagree. 07 gated `http://localhost:3000` out of a deployment on the grounds
  that the deployed dashboard is same-origin and has no use for CORS, so a
  localhost entry in the production allowlist has no beneficiary but a stranger
  running a page on their own machine. Nothing in this ticket changed that
  reasoning: the origin the deployment must trust is the extension's, and that
  is the one it trusts — the spec has development builds of the extension
  pointing at the local API rather than at production, though no extension code
  reads a base URL yet.

  Left as a contradiction rather than settled unilaterally. `spec.md` still
  says the allowlist covers "the pinned extension origin and the local
  development origin", and the code still disagrees with it in production; the
  criterion is unticked so a rollup does not claim otherwise. Settling it means
  either amending that line of the spec or deleting the `NODE_ENV` gate in
  `allowedOrigins()`, and that is the author's call, not this ticket's.
- **The deployment never migrates itself.** There is no release step;
  `apps/web/drizzle/` is applied by hand over the direct connection from a
  machine holding `apps/web/.env.prod`. `DIRECT_URL` from that file wins over
  the one in `.env.local` because the tooling loads the local file with
  `process.loadEnvFile`, which does not overwrite a variable already in the
  environment — so the prod migration is a one-line `set -a` away rather than
  a second config file.
- **`DIRECT_URL` is set on the deployment anyway**, though nothing there reads
  it: leaving one of the five names unset invites the next person to wonder
  which environment is missing what.
- `cors.test.ts` swapped its placeholder extension origin for the real pinned
  one. The assertions pass the allowlist explicitly and did not change — the
  point is that a reader comparing the test to the manifest finds the same
  string rather than a stand-in that happens to be shaped like one.

Verified against production, all from the extension's own origin: the preflight
is a 204 permitting `authorization` with no `access-control-allow-credentials`;
an unlisted origin is a 403 with no `access-control-allow-origin` on it; a
Bearer `GET /api/job-applications` is a 200; no credential is a 401 that still
carries the CORS headers. A create/delete round-trip returned 201 then 204 and
left the list empty again, which is what proves the migrations really are on the
prod project — both enum types included, since the row carried a Status and a
remote type. Signing in on the deployed app was done by hand, to mint the token
those checks used — which is also the browser half of the last criterion. That
token is revocable from the same settings page and nothing in the repository
holds a copy of it.

Locally: 124 tests pass, lint and both typechecks are clean, and the extension
builds with the `key` in its output manifest.
