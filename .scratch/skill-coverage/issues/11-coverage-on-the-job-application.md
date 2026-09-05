# 11: Coverage on the Job Application

**What to build:** Every Requirement on the detail page shows whether the Profile covers it, computed automatically and for free, with the reading visible the moment a Posting is saved.

**Blocked by:** 05, 08, 10

**Status:** done

- [x] Reading a Job Application returns each Requirement's resolved Coverage and the readings behind it
- [x] The normalised reading is computed against the Profile's accepted skill list and recorded with Basis `profile`
- [x] It is recomputed when Requirements change and when the Profile's skills change, and costs no model call
- [x] The detail page shows Requirements grouped by Necessity, each with a Coverage badge
- [x] Each badge has an affordance revealing all three readings, so a surprising verdict can be understood
- [x] A Job Application with no Requirements shows the empty state rather than a comparison
- [x] A user with no Profile is told what to do, rather than shown every Requirement as missing
- [x] Tests go through the Job Applications endpoints, covering Coverage present, Coverage after a Requirement edit, and the no-Profile case

## Comments

Implemented. The automatic reading is stored on the Requirement row rather
than computed on read, as the spec's Storage section says it should be, and
written at the two moments it can change: when a Job Application's
Requirements are replaced, and when the Profile's skill list is accepted or
edited. Both cost one comparison per Requirement and no model call.

Five decisions worth naming.

**A Requirement is read back in a different shape from the one it is written
in.** `RequirementWithCoverage` joins the contract beside `Requirement`, and
`JobApplication.requirements` is a list of the former while
`CreateJobApplication` and `UpdateJobApplication` still take the latter. The
asymmetry is the point: Coverage is what a CV answers back, not something a
client says, and a client that could state one could claim a skill it never
showed. The four Coverage fields are named as `resolvedCoverage` names them,
so the contract's own Requirement resolves through that one function — which
is what issue 10 built the shape for.

**The resolved Coverage is answered alongside the three readings rather than
instead of them.** It is computed in one place, `withCoverage`, so the badge,
the API and issue 15's ring cannot disagree; the losing readings travel with
it because a badge that surprises its reader has to be able to say why.

**A user with nothing to compare against gets `null`, not `missing`.** No
Profile and a Profile whose skill list has not been accepted are one state:
in both, nothing has been read, and writing that down as a verdict would put
"0 of 8" on every board card belonging to a user who has not uploaded a CV.
`normalisedReadingOf` is the one place that rule lives, and the detail page is
told separately whether there is a list at all — an unread Requirement and a
user with nothing to read against look alike on a row and are two different
pieces of news, only one of which is the user's to fix.

**The skill-list sweep is in the same transaction as the write that caused
it.** `setProfileSkills` now runs both, so a reading cannot survive a skill
change that failed. It is at most two statements whatever the size of the
sweep — the automatic comparison can only answer `have` or `missing`, so the
rows are grouped by their new reading rather than updated one at a time.

**`lib/coverage/repository.ts` owns the Coverage columns; the Requirement rows
stay with `job-applications/repository.ts`.** The Analysis (issue 13) and the
override (issue 12) write into the same three columns and now have a home to
write from. `Transaction` moved to `lib/db/client.ts` alongside a `Queryable`,
so a repository function that may run inside somebody else's transaction can
say so.

On the page, each row carries a badge and its readings open underneath it,
across the row's whole width — beside the badge they stretched the column and
pushed the neighbouring rows' controls out of line. `RequirementEdit` now
carries the readings, so a row shows what was last read of it while it is
being edited; a Requirement the user has just typed carries none and reads
"Not read" until the page is saved, which is the truth about it.

Verified by 347 passing tests, and by driving the section in a browser once
with a throwaway Playwright spec that was deleted afterwards, as this repo
keeps exactly one end-to-end test on purpose.

Issue 12 puts an override on the badge, 13 the Analysis, and 15 the ring —
all three read what this returns rather than adding to it.
