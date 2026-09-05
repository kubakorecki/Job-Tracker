# 10: Normalised Coverage and the fit fraction

**What to build:** The pure logic underneath everything visible — matching a skill list against Requirements without a model, resolving three readings into one Coverage, and reducing a Requirement list to the fraction the ring draws.

**Blocked by:** 02

**Status:** ready-for-agent

- [x] A pure module, with no database access and no model call
- [x] Normalised comparison case-folds, strips punctuation and collapses whitespace on both sides before matching
- [x] No alias table and no taxonomy — an Analysis is the escape hatch for what normalisation cannot see
- [x] Normalised comparison yields only `have` or `missing`; `partial` is a judgement about evidence and is not something a string match can reach
- [x] Precedence resolution takes the three readings and returns one Coverage: override, then Analysis, then normalised
- [x] Resolution is a function of a row's values alone, so that the badge, the ring and the API cannot disagree
- [x] The fit fraction counts `required` Requirements only, scoring `have` as one and `partial` as one half
- [x] A Requirement list with no `required` entries yields an absent fraction, not zero
- [x] Tests cover normalisation cases, every combination of the three readings, the half weight, the empty case and the no-required case

## Comments

Implemented as `apps/web/lib/coverage/compare.ts`, the seam the spec's Testing
Decisions name, with `compare.test.ts` beside it. Three functions and nothing
else: `normalisedCoverageOf`, `resolvedCoverage`, `fitFractionOf`.

`resolvedCoverage` takes the three readings under the names a Requirement row
already carries them, as a structural shape rather than a row type, so the row,
the contract's Requirement and anything else holding all three resolve through
one function without being converted first. It answers `null` when none of the
three has spoken — a user with no Profile has nothing read about them, and that
is not the same claim as everything being missing.

Two things the checklist leaves open, decided here:

- **A required Requirement with no reading at all counts towards the
  denominator but not the numerator, and a list where nothing has been read has
  no fraction.** The checklist names only the no-required case, but the same
  principle covers it and the spec is explicit that an unknown fit must not read
  as a bad one (story 48): counting unread Requirements as misses would have put
  "0 of 8" on every board card belonging to a user who has not uploaded a CV.
  The denominator stays every required Requirement rather than only the read
  ones — a denominator that shrank to whatever happened to have been read would
  render "1 of 3" for a Posting insisting on eight things, overstating the fit
  and hiding the five it dropped.
- **Punctuation and symbols are stripped rather than turned into a space**,
  which is what the spec says in both places it describes the rule. It has costs
  in both directions and neither is fixable without the alias table this effort
  refuses: `C`, `C++` and `C#` normalise alike, and `CI/CD` and `ci cd` do not.
  Both are the Analysis's to correct and the user's to override above that; the
  module says so where a reader will meet it.

**Fit Fraction** is now in the glossary. The spec's own words for this — "fit
ring", "the fit fraction" — collide with the `_Avoid_` list on Coverage, which
rules out "fit" and "score" for a Requirement's verdict. They are two concepts,
not one: a Coverage answers one Requirement, and a Fit Fraction reduces a Job
Application's required ones to the two numbers a ring draws. The entry says so,
and carries its own `_Avoid_` list.

`.gitignore` needed narrowing before any of this could be committed. Its
`coverage` entry, boilerplate from the template, matched any directory so named
at any depth — including `lib/coverage`, the path the spec names. It now names
where a reporter actually writes: `/coverage`, `apps/*/coverage`,
`packages/*/coverage`.

Nothing calls any of it yet. Issue 11 computes the normalised reading against
the Profile and returns the resolved Coverage from the endpoints; issue 15 draws
the fraction.
