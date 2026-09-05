# 11: Save this job — extract, review, save

**What to build:** On a Posting, one click reads the page, produces a Draft, and shows it as an editable form. The user corrects anything wrong and saves, and it lands in the same place the dashboard reads from. If extraction finds nothing, the same form opens empty rather than the flow breaking.

**Blocked by:** 09, 10

**Status:** ready-for-agent

- [x] A "Save this job" button is visible whenever a token is configured and the current tab isn't already saved
- [x] Clicking it reads the active tab's visible text on demand, using the already-granted permissions and no persistent content script
- [x] Extraction never runs on panel open, only on an explicit click, so opening the panel on a non-job page costs nothing
- [x] The returned Draft pre-fills an editable review form; nothing is saved until the user confirms
- [x] The Posting's URL is attached to the saved Job Application
- [x] Saving creates the Job Application through the same endpoint the dashboard uses, and it appears on the dashboard
- [x] A `no_job_found` response opens the review form empty with a clear explanation, rather than showing an error
- [x] A `provider_error` response says the provider is unavailable and still offers manual entry
- [x] A `rate_limited` response says the daily limit is reached and that waiting is the remedy
- [x] "Add manually" is available as a secondary action in every state, opening the same form with empty fields
- [x] Cancelling the review form returns to the panel's default view

## Comments

Implemented in `apps/extension`, with one small change either side of it.

- `lib/page.ts` reads the active tab: `browser.scripting.executeScript` with a
  self-contained `func`, injected once per click. No content script, and no new
  permissions — `activeTab` and `scripting` were already in the manifest, so the
  built `manifest.json` is byte-identical to before. A tab that cannot be read
  is an outcome, not an exception.
- `lib/draft.ts` is the Draft-to-form-text conversion and its way back, split
  from the form that renders it exactly as `edits.ts` is split from the
  dashboard's detail view. `createFrom` parses against `CreateJobApplication`,
  so the panel refuses what the endpoint would refuse and the endpoint still
  validates.
- `lib/api.ts` gained `extractJob` and `saveJobApplication`, and all three calls
  now go through one `ask()` that carries the token and answers the two failures
  every call shares.
- `entrypoints/sidepanel/` gained `use-capture.ts` (the whole capture
  lifecycle), `review-form.tsx`, `capture-actions.tsx` and `problems.tsx`.

Decisions worth knowing about:

- **The Draft never reaches the endpoint.** The review form is the only place
  text becomes a `CreateJobApplication`, and what goes up to the hook is that
  value rather than the boxes — one parse, one owner.
- **The contract's failure reason is carried, not renamed.** `ExtractOutcome`
  holds `{ kind: "not-extracted", reason }` in the contract's own words. An
  earlier pass spelt the three reasons a second time in the panel's vocabulary,
  which meant switching on them twice: once to rename, once to act.
- **`no_job_found` and `provider_error` both open the review form** with the
  boxes empty and a line saying why. That is `apps/web/lib/extraction/api.ts`'s
  own reasoning for answering them 200 — "the panel's right response to them is
  to open the manual form" — and it saves the user a second click on a page they
  already asked to save. `rate_limited` deliberately does not: a form would
  suggest the panel could still fill it in, and waiting is the only remedy.
- **`REMOTE_TYPE_LABELS` moved into `@repo/ui`.** It was a local const in the
  dashboard's detail view, whose own comment said it was written "the way
  `JOB_STATUS_LABELS` writes a Status" — and `JOB_STATUS_LABELS` is already
  shared. The review form is the second caller.
- **`RecentOutcome.problem` became `problems: string[]`.** The create endpoint
  answers a rejected body with one `issues` line per offending field, and the
  review form has a box per field; a single sentence would have had to speak for
  all of them. One `<Problems>` component now renders every list in the panel,
  the way `apps/web/app/form.tsx` does for the dashboard.
- **A Status control is in the review form**, which the Draft does not carry.
  Manual entry is the same form, and the dashboard's own add form offers Status;
  without it every hand-recorded Job Application would land as `bookmarked`.
  Ticket 12's Status control on the already-saved view is a different thing.

Reviewed on both axes afterwards. Acted on: the recent list disappearing behind
the settings form, which would have un-checked ticket 10's fixed-shell item —
only the review form takes the body, and it leaves the header standing;
"Add manually" missing from the settings and refused-token states; `createFrom`
running twice per save; the same problem list written out four times; the
reason-to-kind-to-explanation double switch; two differently-shaped functions
both called `answered`; an `asked` counter next to an unrelated `ask()`.

**Deliberate deviation.** "Add manually" is offered in every state except a
first run, where `settings === null`: there is no Job Tracker configured yet, so
the form could not be saved and offering it would be a dead end in front of the
setup form that is already the answer. Every other state that could save carries
it.

**Flagged, not built.** ADR-0002 says "the extension checks it before
extracting", and this panel does not — the URL lookup, the already-saved view
and duplicate rejection are ticket 12, which is blocked by this one. Until it
lands, revisiting a saved Posting spends an extraction and the save comes back
as a 409 rendered through `problems`.

**Resolved since (2026-09-05).** The "still needs a human" check below found
the failure, and it was worse than the guess: Chrome grants `activeTab` to no
side panel at all, by design, so every "Save this job" was unreadable and the
message's remedy was impossible. `tab.url` was invisible for the same reason,
which disabled ticket 12's lookup in any packed build. The manifest now asks for
`http://*/*` and `https://*/*` and drops `activeTab` — ADR-0005.

**Still needs a human**, as with ticket 10: the panel cannot be driven from here
(Chrome automation refuses `chrome-extension://` URLs) and the flow needs a real
token. Load `apps/extension/.output/chrome-mv3` unpacked, or run
`pnpm --filter extension dev`. One thing to check specifically: `activeTab` is
granted by the toolbar click that opens the panel and is revoked when the tab
navigates, so "open the panel, then browse to a Posting, then click Save" may
land on the unreadable path rather than extracting. It degrades to the empty
form with an explanation naming the remedy, but if that is the common flow the
answer is a host permission, which is a change to the manifest and to ADR-level
thinking about what the extension may read.

Typecheck, lint and build clean; the 152 existing tests still pass. Per the
spec's Testing Decisions the side panel gets no seam of its own, so this ticket
adds no tests: the API seam it drives was already covered by ticket 09.
