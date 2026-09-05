# 13: The Analysis

**What to build:** A deeper check the user triggers on one Job Application. The model reads the Requirements against the Profile's text and answers each one with a Coverage and a line of reasoning — which is what a string comparison cannot do for "5+ years of React" against four years on a CV.

**Blocked by:** 05, 08, 10

**Status:** done

- [x] Its own module and its own route, kept apart from the general Job Application endpoints so a future entitlement check has one home
- [x] Runs only when the user asks; nothing triggers it automatically
- [x] Takes the Job Application's Requirements and the Profile's extracted text, and returns a Coverage and a one-line reason per Requirement
- [x] Can answer `partial`, which is the reading that justifies the whole feature
- [x] Its own prompt and response schema, sharing nothing with job extraction or CV reading but the provider boundary
- [x] The result is stored with Basis `profile`, alongside when it ran, so that reopening the Job Application spends nothing
- [x] An analysed reading supersedes the normalised one; both remain readable
- [x] Spends from the shared daily budget, before the provider is reached
- [x] A provider failure and a spent budget answer distinctly, and neither destroys a previous Analysis
- [x] Staleness is derived, not stored: an Analysis is stale when the Profile or the Requirements changed after it ran
- [x] Staleness is surfaced only while the Job Application's Status is `bookmarked` or `applied`
- [x] Runs on one Job Application at a time; there is no bulk trigger
- [x] Tests substitute the analyser and cover a full result, a `partial` verdict, supersession of the normalised reading, staleness on both triggers, staleness suppressed past `applied`, provider failure, exhausted budget and tenant isolation

## Notes from 12

**Derive staleness from `requirements.created_at`, not `updated_at`.** Setting
or clearing an override writes the Requirement row, so `updated_at` moves when
the user disagrees with a verdict — and an Analysis marked stale for that
reason would be asking for a model call because its own answer was overruled,
which is the opposite of ADR-0004's "re-running an Analysis cannot destroy an
override". Requirements are replaced wholesale on every edit
(`replaceRequirements`), so every row is new whenever what the Posting asks
for changes: `created_at` answers the staleness question exactly, and
`updated_at` answers a different one.

**`recordAnalysedCoverage` is already in `lib/coverage/repository.ts`**, writing
the analysed reading and its reason for one Requirement and answering with the
Requirement as it then reads. Issue 12 needed a real write to prove an override
survives one. Reshape it freely — a run answers about every Requirement at
once, and it will want the stamp this has no idea about.

## Comments

Implemented as `lib/analysis/` and one route —
`POST|GET /api/job-applications/:id/analysis` — with an `analyses` table
holding one stamp per Job Application per Basis, and
`recordAnalysedCoverage` reshaped in `lib/coverage/repository.ts` to write a
whole run's verdicts on a `Queryable`.

Six decisions worth naming.

**The run's stamp is a table of its own, keyed by the Job Application and the
Basis.** The spec asks for the metadata to sit beside the Job Application per
Basis rather than on each Requirement, because staleness is a property of the
whole run; the key is what makes "there is exactly one current Analysis" a fact
the database keeps, so a re-run replaces the stamp rather than accumulating a
history nothing shows. The Tailored CV effort adds its own row here.

**Staleness is arithmetic over four values, answering two questions as one.**
`hasBeenOvertaken` is ADR-0004's rule — has anything the run read moved since —
and `worthTelling` is the Status rule; `isStale` is the two together, because a
client renders `stale` rather than deciding it, and a banner, a greyed verdict
and this endpoint each holding their own copy of the Status rule is how one of
them comes to nag about a Job Application the user cannot act on. Derived on every read, as ADR-0004
requires: a stored flag would have to be unset by every write that could
invalidate it, and the one write that forgot would leave a verdict about a
document that no longer exists reading as current.

**The stamp is the database's `now()`, not the app's clock.** It is only ever
compared against other stored stamps — a Requirement's `created_at`, which
Postgres writes — and two clocks deciding whether an Analysis is stale would
make the answer depend on which machine ran it. Issue 12's note about reading
`created_at` rather than `updated_at` is honoured in
`requirementsChangedAt`, which sits beside `replaceRequirements` because it is
the shadow of that write, and is pinned by a test: overriding a verdict does
not make the Analysis that produced it stale.

**A verdict finds its Requirement by position.** The response schema is flat
for the reason the extraction and CV schemas are — a list of
`{ skill, coverage, reason }` objects is exactly the nested shape Gemini
rejects — so the model answers with two arrays running in step, and
`readReadings` zips them back. That translation is the one piece of this the
API seam cannot reach, so it has its own test file, as extraction's `readDraft`
does: a reply that has drifted out of step costs a verdict rather than putting
one on the wrong Requirement.

**Fewer verdicts than Requirements is a real answer; none at all is not.** A
Requirement the model could not word an opinion about keeps whatever the last
run said, which is the same structure that makes an override survive a re-run —
the Analysis writes one column and reaches no further. A reply that landed on
no Requirement is a provider that could not be understood, and answers 502
rather than stamping a run that read nothing.

**Two refusals cost nothing and happen before the budget is touched**: a Job
Application recording no Requirements, and a user with no CV to read. Both are
422, both distinct from the 502 a provider failure gets and the 429 a spent
allowance gets, and a test pins that the analyser was never called and the
remaining allowance is still there to spend.

The `GET` was not on the checklist and is what makes "staleness is surfaced"
observable at all — the run's own answer would otherwise be the only place it
appeared, and the banner issue 14 builds needs to ask after a page load rather
than after a model call. Nothing else of issue 14's is here: no client, no
control, no interface.

`giveAnalysedCoverage` in `lib/test-support/` now calls `recordAnalysis`
itself, so what the override's tests stand on is the Analysis's own write
rather than a second copy of it; it takes the Job Application id as well,
because the write names both.

Verified by 423 passing tests — 54 of them new, across the endpoint (a full
result, a `partial` verdict, supersession with the normalised reading still
readable, an override still standing above it, both staleness triggers,
staleness suppressed at each of the four later Statuses, a re-run standing
again, provider failure, an exhausted budget, and both tenant directions
including whose CV is read), the provider's translation, and the staleness
rule on its own.

One tension a review surfaced, left as it is deliberately. Staleness reads
`profiles.updated_at`, which moves when the user edits their skill list — and
this cut's Analysis reads only the Profile's prose, never the list. So editing
the list stales an Analysis whose input did not change. ADR-0004 words the rule
narrowly ("the CV it read"), but this checklist says "the Profile ... changed"
and the `profiles` schema comment, written before this ticket, says the two
stamps exist precisely so that "a new document and an edited skill list both"
can stale one. Both readings are defensible and the error is over-eager rather
than under-eager — it offers a re-run nobody needed, rather than hiding one
somebody did. Narrowing it to `uploaded_at` is a one-line change in
`profileChangedAt` if the nudge proves annoying in use.
