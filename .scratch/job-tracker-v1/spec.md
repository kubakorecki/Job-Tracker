# Job Tracker v1

Status: ready-for-agent

## Problem Statement

Tracking a job search in a spreadsheet fails in two places. First, capture: the
moment you find a Posting worth pursuing you are on someone else's site, and
copying company, title, location, salary and a link into another tab is enough
friction that it doesn't happen — so Postings are lost, or saved as bare
browser bookmarks with no Status and no notes. Second, recall: once fifty
applications exist, a flat list can't answer "what am I waiting to hear back
on?" without manual re-reading, and there is nothing stopping the same Posting
being recorded twice under slightly different names.

The user is a single person running their own job search across many sites,
who wants their applications in one place, on any device, with the capture step
costing one click.

## Solution

A web dashboard holding every Job Application, plus a browser extension that
captures one from the Posting you are currently reading.

In the dashboard, Job Applications appear on a kanban board grouped by Status,
draggable between columns, with a table view, client-side search, and a detail
view for editing every field. In the extension, opening the side panel on a
Posting and clicking one button reads the page, sends the text to Gemini for
structured extraction, and shows a Draft pre-filled with company, title,
location, salary and keywords, which the user corrects and saves. If the
Posting has already been saved, the panel says so and shows the existing Job
Application instead of extracting again. Everything the extension writes lands
in the same database the dashboard reads, so a job captured on a laptop at
midnight is on the board in the morning.

## User Stories

### Authentication and access

1. As a job seeker, I want to sign in to the dashboard with email and password, so that my Job Applications are private to me.
2. As a job seeker, I want my session to persist across browser restarts, so that I don't sign in every time I check my board.
3. As a job seeker, I want to sign out, so that I can leave the dashboard open on a shared machine safely.
4. As a job seeker, I want to be redirected to sign-in when I open the dashboard unauthenticated, so that I never see a broken empty board.
5. As a job seeker, I want every request to return only my own Job Applications, so that a bug can never expose someone else's job search.

### Capturing a Posting from the extension

6. As a job seeker, I want the toolbar icon to open the side panel directly, so that capture takes one click rather than navigating a popup.
7. As a job seeker, I want a visible "Save this job" button whenever I'm on a Posting, so that the primary action is never hidden behind a menu.
8. As a job seeker, I want the extension to read the visible text of the page I'm on, so that I don't paste a job description by hand.
9. As a job seeker, I want the page text sent for structured extraction, so that company, title, location, salary and keywords are filled in for me.
10. As a job seeker, I want the extracted result shown as an editable Draft rather than saved directly, so that I can correct the model before anything is persisted.
11. As a job seeker, I want the Posting's URL attached to the saved Job Application, so that I can reopen the original advertisement later.
12. As a job seeker, I want a saved Job Application to appear on the dashboard immediately, so that the extension and the dashboard are never out of step.
13. As a job seeker, I want to add a Job Application manually from the side panel, so that I can record a role I heard about rather than found.
14. As a job seeker, I want extraction to run only when I click, never when the panel opens, so that opening the panel on a non-job page costs nothing.
15. As a job seeker, I want a link to the dashboard in the side panel, so that I can jump from capture to my full board.
16. As a job seeker, I want to see my most recent Job Applications in the side panel, so that the panel is useful even when the current page isn't a Posting.

### Not saving the same Posting twice

17. As a job seeker, I want the panel to recognise a Posting I have already saved, so that I don't create a duplicate by revisiting the tab.
18. As a job seeker, I want the already-saved view to show the Job Application's current Status, so that I can see at a glance where I stand with it.
19. As a job seeker, I want to change Status directly from that view, so that "I just applied" is one click from the Posting itself.
20. As a job seeker, I want the same Posting recognised even when the URL carries tracking parameters, so that arriving via a search page and via a shared link count as one Posting.
21. As a job seeker, I want a non-blocking hint when I'm saving a role similar to one I already have at the same company, so that I notice near-duplicates without being blocked when they're genuinely different roles.

### Extraction that fails gracefully

22. As a job seeker, I want a clear "no job found here" message when the page isn't a Posting, so that I understand nothing was extracted rather than seeing an empty form.
23. As a job seeker, I want to fall back to manual entry whenever extraction produces nothing, so that a model failure never blocks capture.
24. As a job seeker, I want to be told when the LLM provider is unavailable, so that I know the problem is temporary rather than my input.
25. As a job seeker, I want to be told when I've hit my daily extraction limit, so that I know to wait rather than retrying pointlessly.
26. As a job seeker, I want very long Postings to still work, so that a page with a huge boilerplate footer doesn't break capture.

### Managing Job Applications on the dashboard

27. As a job seeker, I want a kanban board grouped by Status, so that I can see my pipeline shape at a glance.
28. As a job seeker, I want to drag a Job Application between columns, so that updating Status feels like moving a card, not filling a form.
29. As a job seeker, I want the card to move immediately when I drop it, so that the board feels responsive.
30. As a job seeker, I want the card to snap back with an explanation if the change fails, so that I never believe a change was saved when it wasn't.
31. As a job seeker, I want to retry a failed Status change from that message, so that a dropped connection costs me one click.
32. As a job seeker, I want each card to show company, title, applied date and a Status badge, so that I can identify a Job Application without opening it.
33. As a job seeker, I want a table view as an alternative to the board, so that I can scan many Job Applications densely.
34. As a job seeker, I want my choice of board or table remembered, so that I land in my preferred view every time.
35. As a job seeker, I want to search by company or title, so that I can find a specific Job Application among many.
36. As a job seeker, I want search results to appear as I type with no delay, so that finding something feels instant.
37. As a job seeker, I want to filter by Status, so that I can look at only what I'm waiting to hear back on.
38. As a job seeker, I want to add a Job Application manually from the dashboard, so that I can record roles that never had a Posting.
39. As a job seeker, I want to save a Job Application without a URL, so that referrals and recruiter emails are trackable.
40. As a job seeker, I want to open a Job Application and edit any field, so that I can add notes and correct details as I learn them.
41. As a job seeker, I want to record how excited I am about a role, so that I can prioritise my follow-ups.
42. As a job seeker, I want to delete a Job Application, so that I can remove ones added by mistake.
43. As a job seeker, I want the applied date set automatically when I move a Job Application to applied, so that I don't have to remember to record it.
44. As a job seeker, I want that date preserved when I later move the Job Application to rejected or withdrawn, so that my history isn't erased by an outcome.
45. As a job seeker, I want to edit the applied date by hand, so that I can backfill applications I made before using this tool.
46. As a job seeker, I want clear loading, empty and error states, so that I can tell "nothing yet" apart from "something broke".

### Connecting the extension

47. As a job seeker, I want to generate a Personal Access Token in the dashboard, so that the extension can act on my behalf without my password.
48. As a job seeker, I want to see the raw token exactly once with a copy button, so that I paste it correctly and it is never recoverable from storage afterwards.
49. As a job seeker, I want to name each token, so that I can tell my laptop's token from an old one.
50. As a job seeker, I want to see when each token was last used, so that I can identify tokens that are no longer needed.
51. As a job seeker, I want to revoke a token, so that losing a machine doesn't mean losing control of my data.
52. As a job seeker, I want a revoked token to stop working immediately, so that revocation is meaningful.
53. As a job seeker, I want to paste the token and API base URL into the side panel on first run, so that setup is self-contained in the extension.
54. As a job seeker, I want the extension to remember those settings, so that I configure it once.
55. As a job seeker, I want a development build to point at my local server by default, so that I'm not editing settings every time I switch between developing and using the tool.

## Implementation Decisions

### Shared contract, reshaped first

`@repo/schema` is the contract both surfaces compile against, and it is
reshaped as an isolated first step before any database work, so that the
Drizzle schema mirrors a final contract rather than an obsolete one.

- `jobUrl` becomes nullable. A Job Application may exist with no Posting.
- `CreateJobApplication` requires only `company` and `jobTitle`; every other
  field is optional. Omitted fields default to null; omitted Status defaults to
  `bookmarked`. Previously every nullable field was required-but-nullable,
  forcing clients to send ten explicit nulls.
- A new `ExtractJobResponse` is added: a discriminated union of a success
  variant carrying a `JobExtraction` Draft, and a failure variant carrying one
  of three reasons — no job found, provider error, rate limited.
- `normalizeJobUrl` is added to `@repo/schema` rather than a new package. It is
  the only non-Zod export; the package's identity shifts from "the shared Zod
  schemas" to "the shared contract".

### Persistence

Two Supabase Free-plan projects, dev and prod, per ADR-0003. No local Supabase
stack and no local database.

Three tables. Job Applications mirror the shared contract, plus a stored
normalized-URL column carrying a partial unique index scoped by user, active
only when a URL is present. Personal Access Tokens are stored as a SHA-256
hash alongside a name, creation time, last-used time and a nullable revocation
time — revocation is soft, so a leaked token leaves a trace. Extraction usage
is a per-user, per-day counter keyed on both.

User columns carry no foreign key to Supabase's auth schema: an ORM-managed
foreign key into a schema GoTrue owns and migrates is a recurring migration
hazard, and tenant isolation is enforced in application code per ADR-0001.

The application connects on the pooled Postgres URL with prepared statements
disabled; migration tooling uses the direct connection, because the transaction
pooler does not support session-level DDL.

### Access control

Sign-in only — no self-serve sign-up, no Row Level Security, per ADR-0001. The
account is created in the Supabase dashboard.

A single resolver identifies the current user from either the Supabase session
cookie or a Bearer Personal Access Token whose hash matches an unrevoked row,
updating last-used on success. Every route handler goes through it, and every
database query goes through a repository module that takes the user identifier
as a non-optional argument. No handler builds a query inline: that rule is the
only thing enforcing isolation.

### API surface

The API in the web app is the sole surface for both clients; neither talks to
Gemini or the database directly.

Job Applications get create, list, read, update and delete. Listing accepts an
optional Status filter and an optional URL lookup, the latter normalized before
matching. There is deliberately **no** dedicated status-change endpoint: update
carries Status like any other field, because two paths would need identical
ownership checks and identical applied-date logic and would drift apart.

Moving Status to applied sets the applied date if it is currently unset, and
never clears it on a move backwards.

Personal Access Tokens get list, create and revoke. Listing never returns the
hash; creation returns the raw value once and never again.

Because the side panel runs on an extension origin, every extension call is
cross-origin. A shared CORS layer with an allowlist covering the pinned
extension origin and the local development origin applies to every route,
including preflight handlers, with the authorization header permitted and
credentials off. The extension's ID is pinned in the WXT manifest so it
survives unpacked reloads and the allowlist doesn't go stale.

### Extraction

Gemini via the `@google/genai` SDK, with the model held in a single exported
constant. Page text is truncated to roughly thirty thousand characters from the
front of the document, where the Posting body reliably sits. The response
schema is derived from the Draft shape and is deliberately flat, since Gemini
supports only a subset of JSON Schema and rejects deeply nested schemas.

The endpoint never returns a bare Draft, because an empty Draft is
indistinguishable from a successful extraction of a page with no job on it. It
returns the discriminated union instead. No-job-found and provider-error return
HTTP 200, since the panel's correct response is to offer manual entry;
rate-limited returns 429, since the correct response there is to wait.
No-job-found means company and title both came back empty. There is no
confidence score anywhere — the model cannot calibrate one.

A quota error surfaces as a provider error. There is no silent fallback to a
cheaper model: a visible failure is how the user learns the grant is exhausted.

The daily limit is a hundred extractions per user, applied by upserting the
usage counter in the same request — high enough never to reach in personal use,
low enough to matter if a token leaks.

The provider call sits behind a single extraction function. That boundary is
both the swap point for adding providers later and the substitution point for
tests.

### Dashboard

The board fetches every Job Application under one query key and groups by
Status client-side. Search and filtering are also client-side against that same
cached list: for a personal tracker this is hundreds of rows, so there is no
debounce, no spinner, and no second cache that can disagree with the board.

Status changes are optimistic — snapshot, roll back on error with a toast
carrying a retry action, invalidate on settle. One cache key means one
rollback restores the whole board consistently.

The board/table preference persists in browser storage rather than the URL.

### Extension

The side panel is a fixed shell, not a screen-swapping state machine. A header
links to the dashboard. A primary action area is context-sensitive: setup form
when no token is stored, the existing Job Application with a Status control
when the current tab is already saved, and the save button otherwise. Manual
entry sits as a secondary action in every state. The recent Job Applications
list sits below. The review form replaces the panel body, and cancelling
returns to the default view.

There is no re-extract path for an already-saved Posting: editing happens in
the dashboard. Cross-board duplicates — the same role on a job board and on the
company's own careers page — are two Postings and are never merged
automatically, per ADR-0002; the similar-application hint is advisory only.

The default API base URL comes from a build-time variable so development builds
point locally and production builds point at the deployed API, with the
settings field as an override.

### Sequencing

Contract reshape, then database and access control, then the API, then a deploy
to Vercel with the extension ID pinned and CORS verified end to end, then the
dashboard, then extraction, then the extension, then polish. The deploy sits in
the middle deliberately: connection and CORS problems are far cheaper to
diagnose against six route handlers than against a finished app.

## Testing Decisions

A good test here asserts what a client can observe — a status code, a response
body, a row that survives a reload — and never how it was produced. Tests
address the API the way the extension does, so a rewrite of the repository
module or a change of ORM leaves them passing. No test reaches into a query
builder, asserts a call count, or inspects internal module state.

**The API is the primary seam, and nearly the only one.** Route handlers are
plain request-to-response functions and are exercised directly. One seam covers
input validation, per-user scoping, URL normalization and duplicate rejection,
the applied-date side effect, token authentication and revocation, rate
limiting, and every branch of the extraction response union.

Two consequences make this seam unusually cheap here. Tests authenticate with a
Bearer Personal Access Token, which is a row in a table this project owns, so
Supabase Auth never enters the test path. And since the user columns carry no
foreign key into the auth schema, no auth service needs to exist for the schema
to be complete.

**Tests run against the dev Supabase project**, not a local container — keeping
faith with ADR-0003's "switching environments never means running different
software". This has consequences that must be designed for rather than
discovered:

- A dedicated test user, distinct from both the human's account and the
  end-to-end test's account, so a test run can never touch real Job
  Applications and per-user scoping assertions have a real second user to prove
  isolation against.
- Every test creates the data it needs and removes it afterwards; no test
  assumes an empty database or a particular row count.
- Tests run serially rather than in parallel workers. They share one remote
  database, and the unique index on normalized URL per user makes concurrent
  tests that touch the same Posting collide.
- Tests are network-bound and will fail while the dev project is paused. That
  is an accepted cost of not running a local stack.

**The LLM provider is substituted at the extraction function**, not at the HTTP
client. Extraction endpoint tests inject a fake that returns a Draft, an empty
result, or an error, which is enough to cover truncation, all three failure
reasons, the 200-versus-429 split, and rate-limit accounting without a network
call or an API key.

**`normalizeJobUrl` gets no seam of its own.** Its behaviour is asserted
through the API — save a Posting with tracking parameters, then look it up by a
differently-parameterised form of the same URL and expect a hit; attempt a
duplicate save and expect rejection. This keeps the seam count at one for the
whole backend, and tests the property that actually matters (the extension's
lookup and the API's write agree) rather than the string transformation in
isolation.

**A single end-to-end test** is the second and last seam: sign in, add a Job
Application manually, change its Status, reload, confirm it persisted. It runs
against the local dev server pointed at the dev project, signs in through the
real form once and reuses the stored session, and removes the Job Application
it created. It exists to prove the dashboard, API and database are wired
together at all — not to cover dashboard behaviour, which would make it slow
and brittle.

**No seams for**: the repository module, React components, or the side panel.
Mocking the extension APIs would cost more than it catches at this size; the
side panel is verified by hand against the Definition of Done.

There is no prior art — the repo has no test runner today, so one is added at
the root with per-workspace projects. The tests written for the API are the
prior art everything later should imitate.

## Out of Scope

Contacts and recruiter tracking, and follow-up reminders or notifications:
both shapes exist in the shared contract for forward compatibility, but neither
gets a table, an endpoint, or a screen.

Status history. Nothing records past transitions; the applied date is the only
temporal trace a Job Application keeps.

Self-serve sign-up and Row Level Security (ADR-0001). A local Supabase stack
(ADR-0003). Automatic merging of the same role posted on two boards
(ADR-0002) — the hint is advisory and the user decides.

Confidence scores on extraction. Resume and cover-letter attachments, and any
file storage. Analytics or keyword-gap analysis. Chrome Web Store submission
assets. Firefox and Edge builds. OAuth for the extension via the browser's
identity API — the pasted Personal Access Token stands in for it.

Component-level tests for the dashboard, and any automated testing of the side
panel.

## Further Notes

**Free-plan pausing.** Supabase Free projects suspend after a week of
inactivity. This affects the dev project — so the API tests and the end-to-end
test will fail until it is unpaused — and equally affects production, since a
job search is exactly the kind of activity that goes quiet for a fortnight.
Unpausing is a dashboard click, and no amount of local tooling would prevent
the production case.

**Model identifier.** The Gemini Pro model constant should be confirmed against
AI Studio before the extraction work begins; the documented identifier moves,
and the key in use is an AI Studio developer key with a grant, not a consumer
subscription.

**Two defaults not explicitly ratified**, called out so they are easy to
overturn: a created Job Application with no Status becomes `bookmarked`, and
page text is truncated from the front rather than by extracting a main-content
region.

**Vocabulary.** This spec uses the terms defined in the root glossary —
Posting, Job Application, Status, Draft, Personal Access Token. Implementation
should keep to them, particularly the Posting/Job Application distinction,
which is what allows a Job Application to exist with no URL and two Postings to
map to two Job Applications.

**Tracker.** Issues live as local markdown; the repo now has git but no remote,
so this stays local until a remote exists and GitHub Issues becomes an option.
