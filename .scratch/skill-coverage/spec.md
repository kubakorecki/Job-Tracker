# Skill Coverage

Status: ready-for-agent

## Problem Statement

A Posting asks for a list of things — React, Terraform, five years of backend,
fluent German, a work permit — and the user has a CV that answers some of them.
Today the tracker records the Posting's asks as `keywords`, a flat list of at
most twelve strings that nothing ever reads back, and it records nothing at all
about the user. So the two questions that actually decide whether to apply, and
what to send, have to be answered by reading the Posting and the CV side by
side in two windows:

- **Do I have what they are asking for?** Worth answering at the moment a
  Posting is bookmarked, because the answer decides whether it is worth
  applying at all, and which gaps are worth closing first.
- **Does the CV I am about to send actually show it?** A different question,
  and the one that decides what goes into a tailored CV — a skill the user has
  but left off the document is invisible to the employer, and a skill the
  Posting never asked for is taking up space.

Neither question is answerable in the product. The flat `keywords` list cannot
even express the difference between something a Posting insists on and
something it merely likes, so a gap in a "nice to have" reads exactly like a
gap in a hard requirement.

## Solution

Two sides, and a comparison between them.

The user uploads their master CV once, as a **Profile**. The file is kept — it
is the truth about the document, downloadable and viewable in the app, replaced
only by uploading another. Text is extracted from it for the model to read, and
a skill list is proposed as a **Draft** which the user reviews, corrects and
accepts; from then on that list is theirs to edit.

A Posting's asks stop being `keywords` and become **Requirements**, each
carrying a **Necessity** of `required`, `preferred` or `unstated` — the third
because a Posting that lists a skill without saying which it is should not be
guessed upward into a hard requirement. Extraction fills them in; the user can
correct them, and can type them by hand for a Job Application that never came
from a Posting at all.

Against each Requirement the product records a **Coverage** — `have`,
`partial` or `missing` — reached three ways, in ascending precedence:
normalised comparison, which is automatic and free; an **Analysis**, which the
user triggers and which asks the model to judge each Requirement against the
CV's prose and explain itself in a line; and the user's own override, which
beats both. All three readings are kept, so a badge can always answer "why does
it say that?".

Every Coverage is measured against a **Basis** — the Profile, or the **Tailored
CV** attached to that one Job Application. Both readings coexist, because they
answer the two different questions above; where only one number fits, the
Tailored CV's reading supersedes the Profile's.

On a Job Application, Requirements appear grouped by Necessity with their
Coverage. On the board and in the table, a fit ring shows how many of the
`required` Requirements are covered — "6 of 8" — so a glance across the board
says where the user actually stands.

This spec covers the first of three efforts. It builds the Profile, the
Requirements, and the Coverage against the Profile. The Tailored CV, and any
generation of one, are out of scope and described at the end.

## User Stories

### The Profile

1. As a job seeker, I want to upload my master CV as a PDF, so that the tracker knows what I can do without me retyping it.
2. As a job seeker, I want to upload my CV as Markdown or plain text, so that I am not forced through a PDF export when I keep my CV as text.
3. As a job seeker, I want the original file kept exactly as I uploaded it, so that what the tracker holds is the document I actually have.
4. As a job seeker, I want to view my uploaded CV in the app, so that I can check what it says without hunting for the file on my machine.
5. As a job seeker, I want to download my uploaded CV from the app, so that the tracker is a reliable place to keep it.
6. As a job seeker, I want to replace my CV by uploading a new one, so that keeping it current is one step.
7. As a job seeker, I want to be told plainly when a file cannot be read, so that I know to export a cleaner copy rather than wondering why nothing happened.
8. As a job seeker, I want to see the skills the model found in my CV before they are saved, so that a bad reading never quietly becomes what the tracker believes about me.
9. As a job seeker, I want to correct, add and remove skills during that review, so that the accepted list is right from the start.
10. As a job seeker, I want to discard a reading entirely, so that a mangled extraction costs me nothing but the upload.
11. As a job seeker, I want to edit my skill list at any time afterwards, so that a skill the model missed does not require me to re-export and re-upload the whole CV.
12. As a job seeker, I want my skill list to survive replacing the file only if I say so, so that a re-upload does not silently discard corrections I made by hand.
13. As a job seeker, I want exactly one Profile, so that there is never a question of which CV the tracker is comparing against.

### Requirements on a Posting

14. As a job seeker, I want the extraction to record what a Posting asks for as separate Requirements, so that each one can be answered on its own.
15. As a job seeker, I want each Requirement marked as required, preferred or unstated, so that a gap in a hard requirement does not look like a gap in a nice-to-have.
16. As a job seeker, I want a Posting that lists a skill without saying how badly it wants it to produce an unstated Requirement, so that nothing is guessed into being mandatory.
17. As a job seeker, I want technologies, practices, qualifications, languages and quantities of experience all recorded as Requirements, so that the list reflects what the Posting actually asks of me.
18. As a job seeker, I want to edit a Requirement's wording on the Job Application, so that I can fix what the extraction got wrong.
19. As a job seeker, I want to change a Requirement's Necessity, so that I can correct a Posting that buried a hard requirement in a paragraph.
20. As a job seeker, I want to add and remove Requirements by hand, so that a Job Application from a referral or a recruiter email can have them too.
21. As a job seeker, I want my existing saved Job Applications' keywords to become Requirements, so that nothing I have already captured is lost.
22. As a job seeker, I want those migrated keywords marked unstated, so that the tracker does not claim to know something the old data never recorded.

### Coverage, automatically

23. As a job seeker, I want each Requirement to show whether my Profile covers it, without me asking, so that the answer is there the moment I bookmark a Posting.
24. As a job seeker, I want that automatic answer to cost nothing and take no time, so that it is always present rather than something I have to remember to run.
25. As a job seeker, I want to see the Requirements grouped by Necessity, so that I read the hard ones first.
26. As a job seeker, I want a Job Application with no Requirements to say so, rather than showing me an empty comparison, so that I can tell "nothing asked" from "nothing matched".

### The Analysis

27. As a job seeker, I want to trigger a deeper check on a Job Application, so that the model can judge things a string comparison cannot — "5+ years of React" against four years on my CV.
28. As a job seeker, I want each Requirement's verdict explained in one line, so that I know what to change in my CV rather than just that something is wrong.
29. As a job seeker, I want the Analysis to be able to answer "partial", so that a near-miss is not rounded to a flat no.
30. As a job seeker, I want the Analysis to replace the automatic verdict where it spoke, so that I am never asked to adjudicate between my own tool's two opinions.
31. As a job seeker, I want to see what the automatic comparison said as well, so that a surprising verdict can be understood rather than just believed.
32. As a job seeker, I want the Analysis to run only when I ask, so that I control what it costs.
33. As a job seeker, I want the Analysis kept after it runs, so that opening the Job Application again does not spend another call.
34. As a job seeker, I want to be told when my Analysis is out of date because my CV or the Requirements changed, so that I am not reading a verdict about a document that no longer exists.
35. As a job seeker, I want to stop being told an Analysis is stale once I have applied, so that the tracker does not nag me about something I can no longer act on.
36. As a job seeker, I want a clear message when the model is unavailable or my daily allowance is spent, so that I know to try later rather than assuming I am a poor fit.

### Overrides

37. As a job seeker, I want to set a Requirement's Coverage myself, so that I have the last word about my own skills.
38. As a job seeker, I want my override to survive re-running the Analysis, so that the model cannot overwrite a decision I made deliberately.
39. As a job seeker, I want to revert an override in one click, so that changing my mind is as cheap as making the call.
40. As a job seeker, I want to see that a verdict is mine rather than the tool's, so that I can tell my own judgement from a machine's.
41. As a job seeker, I want an override to apply to the one Job Application I set it on, so that a decision made about one Posting does not silently change every other.
42. As a job seeker, I want to be nudged to re-upload a CV that mentions a skill I keep overriding, so that a repeated correction becomes a permanent fix.

### At a glance

43. As a job seeker, I want a fit ring on every board card, so that I can see across my whole pipeline which applications I am actually strong for.
44. As a job seeker, I want the same ring in the table view, so that the two views agree.
45. As a job seeker, I want the ring to read "6 of 8" in words as well as colour, so that it is legible without relying on being able to tell red from green.
46. As a job seeker, I want the ring to count only required Requirements, so that a long list of nice-to-haves cannot drag down a job I am well suited to.
47. As a job seeker, I want a partial Coverage to count for half, so that near-misses are neither ignored nor treated as full matches.
48. As a job seeker, I want a Job Application with no Requirements to show no ring at all, so that "unknown" does not look like "terrible fit".

## Implementation Decisions

### Contract

- `keywords` is removed from the shared contract and replaced by a list of
  Requirements, each a skill string plus a Necessity of `required`,
  `preferred` or `unstated`. Necessity is a closed set in the contract, in the
  same style as `JobStatus` and `RemoteType`, and the database enum is derived
  from it rather than retyped.
- The cut-over is clean: no deprecation window and no acceptance of `keywords`
  as an alias. The extension is the only other consumer, it is unpacked with a
  pinned ID, and it is rebuilt in the same change.
- Coverage is a closed set of `have`, `partial`, `missing`. Basis is a closed
  set of `profile` and `tailored-cv`; this effort only ever writes `profile`,
  but the column exists from the start so that the Tailored CV effort adds rows
  rather than migrating them.

### Storage

- A **Profile** row per user holds: a reference to the stored file, its media
  type, the text extracted from it, the accepted skill list, and the timestamps
  that let an Analysis know whether it has gone stale. One row per user, keyed
  by user id — there is exactly one Profile.
- The uploaded file goes to Supabase Storage in a private bucket, read back
  through a short-lived signed URL. This is a deliberate crossing of the v1
  spec's "no file storage" non-goal: a Profile whose file is the truth cannot
  be built without it.
- **Requirements** are a table, one row per Requirement of one Job Application,
  holding the skill, the Necessity, and the three Coverage readings side by
  side — the normalised one, the analysed one with its reason, and the
  override. Three named columns rather than one resolved value, because the
  info affordance has to show what each source said, and because resolution is
  then a pure function of a row rather than a write-time decision that can be
  got wrong once and never noticed.
- Rows carry the Basis they were measured against, so that the Tailored CV
  effort adds a second set of readings without disturbing the first.
- Analysis metadata — when it ran, and what it ran against — lives beside the
  Job Application per Basis, not on each Requirement, because staleness is a
  property of the whole run.
- The migration folds each existing `keywords` entry into a Requirement with
  Necessity `unstated`, then drops the column.

### Reading a CV

- The uploaded file is handed to the model directly rather than parsed locally:
  it reads PDFs natively, which avoids both a parsing dependency and the
  two-column layout failures such libraries have. It returns the document's
  text and a proposed skill list.
- That proposal is a **Draft** in the glossary's sense — reviewed, then
  accepted or discarded, never persisted as itself. It shares the pattern with
  job extraction and nothing else: its own prompt, its own response schema, its
  own provider function. Nothing in it reuses the job extraction's instructions
  or property map, and the two must not be refactored together.
- Accepted skills belong to the user from that point. Replacing the file
  proposes a fresh Draft; the user chooses whether it replaces the accepted
  list or is discarded.

### Requirements from a Posting

- The extraction provider's response schema stays flat, as its own comment
  requires — Gemini accepts only a subset of JSON Schema and rejects nested
  shapes outright. Requirements therefore come back as three parallel arrays of
  strings, one per Necessity, and are folded into one tagged list by the same
  function that already turns empty strings into absent fields.
- The side panel shows extracted Requirements grouped and read-only. Correcting
  them belongs on the Job Application detail page, which is where the user is
  looking at the Coverage anyway; the panel's job is to save a Posting quickly.

### Comparing

- The normalised comparison is a pure function over the accepted skill list and
  the Requirements: case-folded, punctuation-stripped, whitespace-collapsed
  matching. No alias table and no taxonomy — the Analysis is the escape hatch
  for everything normalisation cannot see, and a hand-maintained synonym list
  is a maintenance burden that would never be complete.
- Precedence is resolved in one pure function: override, then Analysis, then
  normalised. The same function serves the badge, the ring and the API.
- The fit fraction counts `required` Requirements only, scoring `have` as one
  and `partial` as one half. A Job Application with no required Requirements
  has no fraction at all — expressed as an absent value, not as zero.
- The Analysis endpoint is its own module with its own route, kept apart from
  the general Job Application endpoints so that a future entitlement check has
  exactly one place to live.
- Staleness is derived, not stored as a flag: an Analysis is stale when the
  Profile or the Requirements changed after it ran. It is surfaced only while
  the Job Application's Status is `bookmarked` or `applied`.

### Model call budget

- The existing per-user daily counter is broadened from counting job
  extractions to counting every model call — job extraction, reading a CV, and
  an Analysis all spend from the same allowance. It is one API key and one
  grant, and the reason the limit exists is indifferent to which call drained
  it. The table keeps its name; the vocabulary around it broadens.

### Interface

- The Job Application detail page grows a Requirements section, grouped by
  Necessity, each row showing its skill, a Coverage badge, an affordance
  revealing all three readings and the Analysis's reason, and controls to
  override, edit and remove. Adding a Requirement by hand is in the same
  section.
- The Analysis is one button on that page, with a stale banner above the
  section when applicable.
- The Profile page lives under settings, beside Personal Access Tokens.
- The fit ring appears on board cards and table rows, showing the fraction as
  text beside the ring, with colour as reinforcement rather than the only
  signal.

## Testing Decisions

A good test here asserts what a caller can observe: the response an endpoint
returns, or the value a pure function computes. It does not assert how a row
was written, which query ran, or what a component rendered internally. Where a
test needs the model, it substitutes the provider function through the existing
factory pattern, so that the suite needs no API key and no network — and the
fake doubles as a way to read what the endpoint decided to send.

Four seams, three of them following the pattern the backend is already tested
through:

- **`lib/job-applications/api.ts`** — existing, extended. Requirements arriving
  and leaving through create, read and update; validation of Necessity; the
  hand-typed case; and that a Job Application with no Posting can still carry
  Requirements. Prior art: `lib/job-applications/api.test.ts`.
- **`lib/profile/api.ts`** — new. Upload, the proposed Draft, acceptance,
  discard, later edits, replacement, and read-back including the signed URL.
  The CV reader is substituted, covering a good reading, an unreadable file and
  a provider failure. Prior art: `lib/extraction/api.test.ts`, which
  substitutes at exactly this kind of seam.
- **`lib/coverage/api.ts`** — new. Running an Analysis and getting verdicts
  with reasons; setting and clearing an override; that an override survives a
  re-run; that a spent allowance and a provider failure each answer distinctly.
  The analyser is substituted the same way.
- **`lib/coverage/compare.ts`** — new, pure. Normalisation cases, precedence
  resolution across all combinations of the three sources, the fit fraction
  including the half-weight for `partial` and the absent-rather-than-zero case
  for no required Requirements. Prior art: `lib/job-applications/filtering.ts`,
  `lib/job-applications/edits.ts`, `lib/dashboard/view.ts` and
  `packages/schema/src/near-duplicates.ts` — the repo already tests decision
  logic directly rather than only through endpoints.

The daily counter is exercised as a real row in the real table, cleared around
each test, exactly as the extraction tests already do.

The Playwright smoke test grows one path: upload a CV, accept the skills, open
a Job Application, and see Coverage on its Requirements.

## Out of Scope

- **The Tailored CV** — a CV attached to one Job Application, uploaded by hand,
  stored with its original file, downloadable, previewable, and adding the
  second Basis to every Coverage. This is the next effort, and the schema here
  is shaped so that it adds rows and columns rather than rewriting them.
- **Generating a tailored CV** from the Profile and a Posting's Requirements.
  Unscheduled, unspecced, and dependent on the Profile having proved itself
  first.
- **Paid plans, entitlements and billing.** The Analysis is intended to become
  a paid feature if the project is commercialised, which is why it sits behind
  its own endpoint and its own trigger. No plan fields, no tier checks, and no
  mention of it in the interface.
- **Bulk analysis** across many Job Applications at once.
- **Sorting or filtering the board by fit.** Worth revisiting once enough
  Job Applications have been analysed for it to mean anything.
- **DOCX uploads.** Everything storable should also be comparable, and DOCX is
  not readable by the model without a parser; exporting to PDF is a ten-second
  step.
- **A synonym or taxonomy table** for skill names.
- **Re-reading Requirements from a stored description** for Job Applications
  that predate extraction. The stored descriptions are a short paragraph at
  most, and hand-editing covers the case.

## Further Notes

The two questions this feature answers are deliberately kept apart in the
model, because they are different questions and both stay useful: "do I have
this?" is answered against the Profile, and "does what I am sending show it?"
against the Tailored CV. Keeping the Profile reading after a Tailored CV
exists is what lets the product say _you have this skill but left it off the CV
you are sending_ — which is the whole point of tailoring, and would be
destroyed by treating the second reading as a replacement for the first.

Three sources of Coverage with a precedence order, and two Bases, is more
structure than a reader would expect for what looks like a checklist. It is the
subject of an ADR in this effort.

The glossary in `CONTEXT.md` was extended while this was designed: Profile,
Requirement, Necessity, Coverage, Basis, Analysis and Tailored CV are defined
there, and Draft was generalised to cover both the job extraction and the CV
reading. Use those words.
