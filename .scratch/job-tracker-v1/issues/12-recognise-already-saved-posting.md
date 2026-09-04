# 12: Recognise an already-saved Posting

**What to build:** Revisiting a Posting the user already saved shows them the existing Job Application and its Status instead of extracting again — even when the URL arrives with different tracking parameters. Near-duplicates at the same company are hinted at, never merged automatically.

**Blocked by:** 11

**Status:** ready-for-agent

- [x] Job Applications carry a stored normalized URL alongside the original, which is kept intact for display and for opening the Posting
- [x] A partial unique index per user prevents two Job Applications sharing a normalized URL, and tolerates Job Applications with no URL
- [x] The list endpoint accepts a URL lookup, normalizing the input before matching
- [x] The panel performs that lookup on open and, on a hit, shows the existing Job Application's company, job title and Status with no extraction call
- [x] Status can be changed directly from that view
- [x] There is no re-extract path for an already-saved Posting; editing happens in the dashboard
- [x] A Posting saved via a tracking-laden URL is recognised when reached later by a clean URL, and vice versa
- [x] Attempting to save a duplicate Posting is rejected rather than creating a second Job Application
- [x] Saving a role at a company where a similar job title already exists shows a non-blocking hint; the save still proceeds if the user continues (ADR-0002)
- [x] The same role posted on two different sites remains two Job Applications and is never merged automatically
- [x] Normalization behaviour is proven through the API — save with tracking parameters, look up by a different parameterisation, expect a hit — rather than by testing the normalizer directly

## Comments

The first two items were already true: `normalized_job_url` and its partial
unique index landed in the very first migration, and duplicate rejection on
both create and patch came with ticket 11. This ticket added the lookup, the
already-saved view, and the hint.

**`GET /api/job-applications?url=`** is a filter on the list rather than an
endpoint of its own. "Not saved" is then an empty list instead of a 404 the
caller would have to read as an answer rather than a refusal, and a hit is a
Job Application in the same shape every other read gives it. `?status=` and
`?url=` compose, because they are two clauses of one `and()` — forbidding the
pair would have taken more code than allowing it.

**The panel sends the tab's address as it found it, and the API normalizes.**
See the deliberate deviation below.

- `lib/page.ts` gained `readActiveUrl`, which queries the tab and injects
  nothing. That is what makes a lookup on open affordable: no page read, no
  share of the extraction grant, so ticket 09's "extraction never runs on open"
  still holds.
- `use-saved-posting.ts` is the lookup and the Status change; `saved-posting.tsx`
  is the view. A Posting that is already saved is answered with the Job
  Application, and "Save this job" is not offered — reading the page again could
  only produce a Draft the API would refuse as a duplicate, and overwriting the
  user's own corrections with the model's second guess is not something they
  asked for. Editing is a link to the dashboard.
- Every other lookup outcome, including one that failed and one over a tab the
  extension cannot read, leaves the ordinary path in place: a Posting the panel
  cannot rule out being new is one the user may still want to save.
- `nearDuplicatesOf` in `@repo/schema` is the hint's rule — same company, and
  one title's words all appear in the other's. The review form recomputes it as
  the user types and renders a line; nothing is blocked, and Save is the same
  button it was.

**Deliberate deviation from ADR-0002.** The ADR says "the extension normalizes
before its lookup and the API normalizes before its write, and the two must
agree exactly or the check passes while the insert conflicts". The extension
does not normalize. It sends the raw URL and the API normalizes both sides,
which removes the disagreement the ADR was guarding against rather than making
it unlikely — one rule, one place, and no way for the two to drift. This serves
the ADR's intent and contradicts its stated mechanism; the ADR is left as it
stands rather than rewritten here, and `normalizeJobUrl`'s docstring now says
which of the two is true. **Worth reopening in `/domain-modeling`.**

**Deliberate deviation on seams.** `packages/schema/src/normalize-job-url.test.ts`
is deleted, which is what the last item of this ticket asks for and what the
spec's "`normalizeJobUrl` gets no seam of its own" always wanted — it was only
standing in until an API lookup existed to prove the property through. That
proof is now in `api.test.ts`: save with `utm_source` and `trackingId`, look up
clean, and the reverse.

Against that, `near-duplicates.test.ts` **adds** a seam the spec did not
sanction. The spec's own argument does not carry over: `normalizeJobUrl` has an
API-observable property and this does not — the hint is client-side, the side
panel gets no tests, so the choice was between the contract package's existing
seam and no proof at all for a judgement-laden rule about what counts as
"similar".

**Flagged, not built.** The lookup runs on panel open, which is what this ticket
asks for, and not again when the tab navigates. Re-checking on navigation needs
the `tabs` permission — a manifest and ADR-level change about what the extension
may read, which is the same thing ticket 11 flagged and declined. On that path
`activeTab` is revoked anyway, so the panel degrades to offering "Save this
job", and the read explains itself.

**Still needs a human**, as with tickets 10 and 11: the panel cannot be driven
from here and the flow needs a real token. Load
`apps/extension/.output/chrome-mv3` unpacked. Worth checking specifically: open
the panel on a Posting you have already saved and confirm it shows the Job
Application and its Status rather than a Save button, that changing the Status
sticks after a reload, and that the hint appears when you save a second,
similarly-titled role at a company you already have one at.

Reviewed on both axes afterwards. Acted on: "Add manually" disabled while the
lookup was in flight, which would have un-checked a ticket 11 item; one name
(`SavedPosting`) for both a union and a component, which is what commit 1f6921b
renamed away from; a `saved()` helper that was a third meaning of the word, and
the `jobApplications.jobApplications` stutter it left; the company-and-title
markup written twice, now `JobApplicationName`; a now-false docstring on
`normalizeJobUrl`; hint copy saying "an application", which `CONTEXT.md` lists
under _Avoid_; a dead `disabled` prop on `AddManually`.

Typecheck, lint and build clean. 200 tests pass — 161 in the web app, 39 in the
contract. The built `manifest.json` is byte-identical to before: no new
permissions.
