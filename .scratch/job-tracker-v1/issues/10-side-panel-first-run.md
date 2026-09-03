# 10: Side panel first run and recent Job Applications

**What to build:** Opening the side panel for the first time asks for a token and where the API lives; afterwards it shows the user's most recent Job Applications, so the panel is useful even on a page that isn't a Posting.

**Blocked by:** 07

**Status:** ready-for-agent

- [x] The toolbar icon opens the side panel directly, with no popup
- [x] With no token stored, the panel shows a setup form for the Personal Access Token and the API base URL
- [x] Those settings are stored locally and survive browser restarts
- [x] The default API base URL comes from a build-time value, so development builds point locally and production builds point at the deployed API
- [x] The settings field overrides that default
- [x] The panel is a fixed shell: a header linking to the dashboard, a primary action area, and the recent list below — not a sequence of replacing screens
- [x] With a token stored, the panel lists the user's five most recent Job Applications
- [x] An invalid or revoked token produces a clear message and a route back to the setup form

## Comments

Implemented in `apps/extension`:

- `lib/settings.ts` is the stored pair — the raw Personal Access Token and the
  API base URL — behind `readSettings`/`writeSettings`/`watchSettings`, so
  nothing else knows the storage key or the area. `local`, not `session`, is
  what makes it survive a restart.
- `lib/api.ts` is how the panel addresses one Job Tracker: the one call it
  makes today, and the dashboard pages it links to.
- `entrypoints/sidepanel/` holds the shell (`App.tsx`), the setup form, the
  recent list, and a hook each for the two things the panel reads.
- The toolbar icon already opened the panel directly — `background.ts` set
  `openPanelOnActionClick` and the manifest has no `default_popup`. Confirmed
  against the built `manifest.json` rather than assumed.

Decisions worth knowing about:

- **The default API base URL is `import.meta.env.DEV`**, not a runtime check
  or a config file. Vite replaces it with a literal, so the branch not taken
  is gone from the bundle: verified by grepping the two outputs, and
  `.output/chrome-mv3` contains only the deployed URL while
  `.output/chrome-mv3-dev` contains only `localhost:3000`.
  `WXT_API_BASE_URL` overrides both for a build aimed elsewhere — WXT sets
  Vite's `envPrefix` to `["VITE_", "WXT_"]` and Vite's `loadEnv` reads
  prefixed names out of the environment, so no `.env` file is needed, which
  matters because the repo's `.gitignore` keeps them all out. It is named in
  `turbo.json`'s `globalEnv` so a cached build is not reused across two
  values.
- **A refused token is an answer, not an exception.** `lib/api.ts` never
  throws: `token-rejected` is its own member of the outcome union because it
  is the only failure the panel _acts_ on — it offers the way back to the
  setup form — where everything else it can only report.
- **The discriminant is `kind`, not `status`.** `Status` in this project is
  where a Job Application sits in the pipeline, and the panel puts one of
  those next to every row of this very list. `state` and `phase` are on the
  glossary's _Avoid_ list for the same term.
- **The five are taken in the panel**, not asked for. The endpoint already
  answers newest-first, and a page size only one caller would ever use is not
  worth teaching the API.
- **No host permissions were added.** The panel reaches the API cross-origin
  on the strength of the CORS layer ticket 07 built, which is exactly what
  that layer is for.
- **The API's error shape is read tolerantly rather than shared.** `refusal()`
  reads `error` and falls back to the status code, which duplicates
  `problems()` in `apps/web/lib/api/client.ts` — the two apps cannot import
  each other and only `@repo/schema` sits between them. Moving `ApiError`
  into the contract would fix it properly and is a change to the contract
  package, so it is left for whoever needs it second.

Reviewed on both axes afterwards. Acted on: the `status` discriminant colliding
with the glossary's Status; `RecentJobApplications` naming both the outcome
union and the component (the union is `RecentOutcome`, the hook's is `Recent`);
a comment claiming `apiBaseUrl` was an origin when `parseApiBaseUrl`
deliberately keeps a path; the response body checked with `Array.isArray`
rather than asserted, so a base URL pointing at some other 200 says so instead
of rendering rows out of it; the two dashboard addresses moved out of the
components into `lib/api.ts`; `body()` renamed `contents()`; a why on the
re-test of `parsed`; a grouped CSS rule immediately overridden; the root
README's claim that the panel is a scaffold. Left alone deliberately: the
recent list is absent rather than an empty heading before a token is stored —
the shell's regions hold their places for a configured panel, which is what the
fixed-shell claim is about; loading, empty and failure lines are the minimum a
list that fetches can render, and ticket 14 owns making them read well and
adding retry; re-saving an _identical_ refused token does not refetch, which is
the deliberate consequence of keying the effect on the two strings, and the
case that matters — pasting a new token after a revocation — does.

Typecheck, lint and build clean; the 152 existing tests still pass. Per the
spec's Testing Decisions the side panel gets no seam of its own, so it carries
no tests. Against a running dev server, the path the token-rejected state rests
on was checked directly: a preflight from
`chrome-extension://okeljopaafaojopfkhjioaceeohjplhb` is a 204 permitting
`authorization`, and a Bearer request with a bogus token is a 401 that still
carries `access-control-allow-origin` — without that header the browser would
withhold the response and the panel would report an unreachable API instead of
a refused token.

**Still needs a human**: the panel itself, in a browser. It cannot be driven
from here — Chrome automation refuses `chrome-extension://` URLs — and the
first run needs a real token, which ticket 07 also left for a human. Load
`apps/extension/.output/chrome-mv3` unpacked, or run
`pnpm --filter extension dev` for a build that defaults to `localhost:3000`,
and check the eight boxes above by hand.
