# 15: The fit ring on the board and the table

**What to build:** A glance across the whole pipeline that says where the user actually stands — a partially-filled ring with the fraction beside it, on every board card and every table row.

**Blocked by:** 11, 10

**Status:** done

- [x] A ring on each board card and each table row, drawn from the fit fraction
- [x] The fraction is shown as text beside the ring — "6 of 8" — so the meaning does not depend on telling red from green
- [x] Colour runs red through amber to green across the ratio, as reinforcement rather than the only signal
- [x] Only `required` Requirements count; `partial` counts for half
- [x] A Job Application with no Requirements, or none marked `required`, shows no ring at all — an unknown fit must not read as a bad one
- [x] The ring reads the same resolved Coverage the detail page does, so the two views cannot disagree
- [x] A label says which Basis the ring reflects, so that the Tailored CV effort can change it without the meaning shifting silently
- [x] Board and table use one shared component

## Comments

Implemented as one component, `app/dashboard/fit-ring.tsx`, and one pure module
beside the comparison it draws, `lib/coverage/fit-ring.ts`, with
`fit-ring.test.ts` next to it. Nothing was added to the API and nothing to the
contract: the board's cached list already carries every Requirement with its
readings (issue 11), so the ring is arithmetic over data that was already on
the page.

Four decisions worth naming.

**The component is handed the Requirements, not a fraction.** It calls
`fitFractionOf` itself, which resolves each Requirement through
`resolvedCoverage` — the same function the detail page's badge reads by. A
prop carrying a number would have let a caller compute one, and two callers
computing one is exactly the second opinion ADR-0004 exists to rule out. The
checklist asks that the ring and the detail page cannot disagree; passing the
raw Requirements is what makes that structural rather than a thing to
remember.

**The Basis is named on every ring rather than once per view.** A column
heading would have been quieter, and it will be wrong the moment the Tailored
CV effort lands: that effort adds a second reading to some Job Applications and
leaves the rest on the Profile, so two rings side by side will be about two
different CVs. A heading could then only be right about some of the rows under
it. So the word rides with the ring — "2 of 4 Profile" — and `RING_BASIS` in
`lib/coverage/fit-ring.ts` is the one place it is chosen, named beside
`PROFILE` in `coverage/repository.ts` so the display side and the storage side
of that change are found together.

**Colour moves with the ratio rather than in steps, and only the arc carries
it.** Hue runs 0° to 120° across the fraction, saturation and lightness held
still — a fit that improves by half a Requirement looks slightly better rather
than identical until it crosses a threshold somebody chose, and one palette
serves both the light and the dark background. The fraction beside it is in the
page's own text colour, so nothing is said in colour alone (story 45). A zero
fraction draws no arc at all — `strokeLinecap` is `butt` deliberately, because
a round cap would put a dab of red on the one fraction that has to draw
nothing.

**A half is written as a half.** `partial` counts for half a Requirement, so
"5.5 of 8" is a fraction the ring can hold. Rounding it to "6 of 8" would claim
a full match the user has not been given, and halves are exact in binary, so
this never reads as a run of decimal places.

Two smaller things. The ring returns nothing at all where there is no fraction,
which is what lets the card hide the line it would have sat on and the table
leave an empty cell — the table's other columns use "—" for a field nobody
filled in, and a mark in a column of rings would read as a verdict rather than
as an absence (story 48). And Fit sits before Status in the table, ahead of
where a Job Application sits and when it was applied for, because scanning down
it is the whole reason the column is there.

Verified by 444 passing tests — twelve of them new, all on the wording, the
ratio and the colour — and by driving both views in a browser against the dev
project with a throwaway Playwright spec that was deleted afterwards, as this
repo keeps exactly one end-to-end test on purpose: against the end-to-end
user's five accepted skills, a Posting insisting on four things and preferring
a fifth drew "2 of 4 Profile" in amber, one insisting on a single skill they
have drew a full green "1 of 1 Profile", and a Job Application with no
Requirements and one whose only Requirement is `preferred` drew no ring on
either the board or the table.
