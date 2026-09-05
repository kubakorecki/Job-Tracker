# 12: Overriding a Coverage

**What to build:** The user has the last word. Setting a Requirement's Coverage by hand beats both the automatic reading and the Analysis, survives a re-run, and can be reverted in one click.

**Blocked by:** 11

**Status:** done

- [x] A Requirement's Coverage can be set by the user to any of `have`, `partial` or `missing`
- [x] An override takes precedence over both other readings
- [x] An override survives re-running the Analysis — the model cannot overwrite it
- [x] An override can be cleared, after which the Requirement falls back to the Analysis, or to the normalised reading if none has run
- [x] An override applies to the one Job Application it was set on, and never to another
- [x] The badge shows visibly that a verdict is the user's rather than the tool's
- [x] Setting an override to `have` offers a nudge to upload a CV that mentions the skill, since a repeated override is a sign the Profile is out of date
- [x] Overrides are scoped to their user
- [x] Tests cover setting each value, precedence over both other readings, survival across a re-run, clearing, and tenant isolation

## Comments

Implemented as `lib/coverage/api.ts` and one route —
`PUT|DELETE /api/job-applications/:id/requirements/:requirementId/coverage` —
with `setOverriddenCoverage` beside the other Coverage columns in
`lib/coverage/repository.ts`. Nothing about precedence had to be written: issue
10's `resolvedCoverage` already put the override on top and issue 11 already
resolved on read, so this ticket is a column, an address and a control.

Five decisions worth naming.

**A Requirement is now addressable, and `RequirementWithCoverage` carries its
id.** An override names one Requirement rather than restating the list, so it
needs an address, and the two candidates were the row's id and its position.
Position is the natural key the schema comment names, but it is the client's
copy of an ordering: a row removed locally and not yet saved shifts every index
after it, and an override sent against a stale position lands silently on the
Requirement's neighbour. An id that no longer exists is a 404. The write shape
is untouched — a patch still states the whole list, because a correction
changes the skill and the skill is all a client could have identified it by —
so the read/write asymmetry issue 11 opened widens by one field for the same
reason it opened at all.

**Setting and clearing are two requests, and both answer with the
Requirement.** A nullable `coverage` in one body would let "I have this" and
"forget what I said" arrive through the same door and be confused for one
another by anything that builds a body from a form. A cleared override answers
with what it fell back to, which is the whole point of clearing it — the client
would otherwise have to go and look, and the badge would flicker through a
verdict nobody holds.

**Survival across a re-run is structural rather than defended.** The override is
its own column and an Analysis writes only the analysed one, so there is no
write for a re-run to lose against. It is still tested, because the claim is
worth pinning: `recordAnalysedCoverage` writes the two analysed columns —
exactly what issue 13 will write, from the module that owns those columns, so
the stand-in is a real query with a real owner rather than one built inside a
test (ADR-0001). `lib/test-support/analysis.ts` is the two-line call, and the
tests that use it say what they are standing in for. Nothing in the
application calls it yet; issue 13 is what will.

**The override lives inside the badge's disclosure, not on the row.** Overruling
a verdict is something a person does having just read why it says what it does,
and the row already holds a skill box, a Necessity select, a badge and a remove
button. On the line where "Your own" was reported there is now a select with
four states, the fourth being the tracker's own reading — so reverting is the
same one choice as making the call (story 39), rather than an undo control
that appears only once there is something to undo. With the panel open it is
one interaction; the panel itself is the click before it. It saves as it is set: what the user thinks of a verdict is not a
correction to what the Posting asked for, and holding it to a form that may be
carrying half-typed text would make the last word the slowest one. A Requirement
the user has just typed has no row yet and so gets no control, and says so.

**The nudge is offered once, at the moment it is earned.** Standing under every
claimed skill for as long as the CV is out of date, it would be read as
decoration within a day. It appears on the change that sets `have`, and only
where there is a skill list that does not show the skill — a user with no
Profile is being told that by the section above, and claiming something the
comparison already found is not news. `worthNudging` is that rule, beside the
readings rather than in the row that renders them.

The spec's story 42 says "a skill I **keep** overriding", and this does not
count. Repetition would mean holding what the user has overridden across Job
Applications and deciding how many times is a pattern, which is a feature the
ticket does not ask for; the condition that is here — you have claimed
something your CV does not show — is the same signal that repetition would be
evidence of, caught the first time rather than the third.

Two consequences worth knowing about, one inherited and one introduced.

Writing an override touches the Requirement row, so `updated_at` moves with it
— and issue 13 derives staleness from whether the Requirements changed after
an Analysis ran. Read off that column, an override would mark an Analysis
stale for the sole reason that the user disagreed with it, which is the
opposite of what ADR-0004 promises. Requirements are replaced wholesale on
every edit, so `created_at` answers "did what the Posting asks change?"
exactly and `updated_at` does not; issue 13 has a note to that effect.

Inherited rather than introduced: saving a
change to a Job Application's Requirements replaces every row, so the overrides
on that Job Application go with them. That is issue 11's delete-and-insert, and
it is right for a skill whose wording changed; it is now also true of a
Requirement the user only reordered around. Carrying readings across a replace
means matching rows by a skill that is precisely what the edit may have
changed, so it is left as it is — but the cost is user-visible now that there
is something of the user's own to lose, and it belongs in whatever ticket next
touches that write.

`withCoverage` moved from `job-applications/repository.ts` to
`coverage/repository.ts`, which owns those four columns: every write of a
reading answers with the Requirement it changed, and two copies of the
precedence order is exactly what ADR-0004 rules out.

Verified by 369 passing tests — 22 of them new, 19 through the endpoint, covering
each value, precedence over both other readings, survival across a stand-in
re-run, clearing back to the Analysis and to the automatic comparison and to
nothing at all, one Job Application not reaching another's, and both tenant
directions — and by driving the control in a browser once with a throwaway
Playwright spec that was deleted afterwards, as this repo keeps exactly one
end-to-end test on purpose.
