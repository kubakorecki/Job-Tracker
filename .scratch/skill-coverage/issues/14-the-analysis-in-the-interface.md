# 14: The Analysis in the interface

**What to build:** The button that runs it, the reasons it produces, and the banner that says the answer has gone out of date.

**Blocked by:** 13, 11

**Status:** done

- [x] One clearly-labelled control on the Job Application detail page runs the Analysis
- [x] A pending state while it runs, since the model call is not instant
- [x] Each Requirement's reason is readable next to its badge
- [x] The badge shows that a verdict came from the Analysis rather than the automatic comparison, and the affordance still reveals what the automatic comparison said
- [x] A stale Analysis is shown greyed with a banner explaining why and offering a re-run
- [x] Staleness is not shown once the Status has moved past `applied`
- [x] A provider failure and a spent daily budget are reported in plain language, and distinguishably — one says try later, the other says the day's allowance is gone
- [x] Nothing in the interface mentions plans, tiers or payment

## Comments

Implemented as `app/dashboard/job-applications/[id]/analysis.tsx`, one new pure
function — `coverageSource` in `lib/coverage/compare.ts` — and
`lib/analysis/client.ts` for the two addresses issue 13 built. The page reads
the Analysis on the server beside the skill list it already read, so the banner
is there on the first paint rather than after a request.

Six decisions worth naming.

**Where a verdict came from is a question `compare.ts` answers, not the badge.**
The badge had to say "this one is the model's", which is a test of the
precedence order — and issue 12's badge already carried half of one
(`overriddenCoverage !== null`). Writing the other half beside it would have put
ADR-0004's order in a component, where nobody would think to look for it. So
`coverageSource` names the reading that won, `resolvedCoverage` is now the
value of whatever it names, and both walk one list. It is a change to code
issue 10 shipped, deliberately: the ADR's promise is that one function serves
the badge, the ring and the API, and a second opinion about precedence is
exactly what it rules out. The test table that already stated all eight
combinations now states who spoke in each, and pins that the source named is
the source of the very verdict resolved to.

**The model's line is on the row, and only there.** A reason behind a
disclosure is one nobody reads twice, and reading them is the whole of what a
model call bought — a page of them is the answer to "what do I change?". It
sits under the row rather than beside the badge, across the width, which is
where issue 11 put the readings and for its reason: a sentence in a flex row
either stretches the column or pushes the neighbouring rows' controls out of
line. The panel below it lost its copy of the reason rather than repeating it
an inch under itself.

**The badge's staleness and the panel's are two different questions, and it
matters.** The badge greys only where the verdict on show is the Analysis's —
an overridden Requirement reads as the user's word, in full colour, because
nothing about it went out of date. The panel marks the Analysis's line whenever
there is one to mark, whatever won above it. Asking the badge's question in the
panel is a bug I shipped and a review caught: a Requirement the run never
answered about read "Analysis (out of date) — Not run", which is a complaint
about a verdict nobody gave.

**The banner does not promise the old verdicts are still under it.** It first
said they were greyed below, which is true when the Profile moved and false the
moment the Requirements did: saving an edit replaces every Requirement row
(issue 11's delete-and-insert), and a row's analysed reading goes with it. So a
Requirements edit leaves a run that is stale and has nothing left to show for
itself. The banner now says the one thing true of both — what the model last
said is about something that is no longer there. The greying is still right
wherever the verdicts survive, which is every CV change. This is the same cost
issue 12 recorded against overrides, now paid by something the user spent a
model call on, and it still belongs to whatever ticket next touches that write.

**A save asks the endpoint again; nothing on the page works out staleness.**
Both halves of the rule move on a save — editing the Requirements is one of the
two things that can overtake a run, and moving the Status past `applied` is
what stops it being worth saying — and both live in `analysis/staleness.ts`. A
client that recomputed either would be the second copy ADR-0004 exists to
prevent, and the one that forgot the Status rule would nag about a Job
Application the user cannot act on. So a save that finds an Analysis re-reads
it through `GET`, which spends nothing; a failure to re-read leaves the banner
as it was rather than reporting a problem under a form that has just saved.

**The control is not offered where it could only fail, and is held back while
the list on screen is not the list that would be read.** Neither is on the
checklist. The first is nothing: a Job Application recording no Requirements
gets a 422 without spending anything, and a button that can only refuse is not
one to offer. The second is a judgement — with unsaved Requirement edits the
button is disabled and says to save first. An Analysis reads what the database
holds, so running one there answers about a list the user has already changed,
and the save that follows would then replace every row and take the verdicts
with it: a model call spent to be thrown away. It costs the user the ability to
analyse the saved list while a correction sits half-typed, which is the price of
not letting them buy nothing. One sentence and one disabled state; strike it if
that trade reads wrong.

Whether there is a CV to read is deliberately not asked on the page. The answer
is the Profile's prose, which the page does not hold — the skill list it does
hold is a different thing, and a user who uploaded a CV without accepting its
skills can be analysed. The endpoint says so plainly instead, as it does for
the two failures the checklist asks to be told apart: one says try again
shortly, the other says the day's allowance is gone. Neither this page nor the
badge mentions a plan, a tier or a price.

Verified by 432 passing tests — nine of them new, all on `coverageSource` —
and by driving the whole path in a browser against the dev project with a
throwaway Playwright spec that was deleted afterwards, as this repo keeps
exactly one end-to-end test on purpose: a real run against a real CV answering
"Partly · analysed" to "5+ years of React" with the line "You mention four
years of experience with React, while the role asks for at least five", the
badges greyed under the banner after the Profile moved, the banner gone once
the Status passed Applied, and both refusals rendering in the endpoint's own
words. That run left the end-to-end user with a Profile in the dev project —
a two-paragraph Markdown CV and five accepted skills — which nothing removes
and nothing else reads.

Issue 15's ring reads the same resolved Coverage this page shows, and gets the
board's cached list invalidated by every run.
