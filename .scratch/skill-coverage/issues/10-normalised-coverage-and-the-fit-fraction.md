# 10: Normalised Coverage and the fit fraction

**What to build:** The pure logic underneath everything visible — matching a skill list against Requirements without a model, resolving three readings into one Coverage, and reducing a Requirement list to the fraction the ring draws.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] A pure module, with no database access and no model call
- [ ] Normalised comparison case-folds, strips punctuation and collapses whitespace on both sides before matching
- [ ] No alias table and no taxonomy — an Analysis is the escape hatch for what normalisation cannot see
- [ ] Normalised comparison yields only `have` or `missing`; `partial` is a judgement about evidence and is not something a string match can reach
- [ ] Precedence resolution takes the three readings and returns one Coverage: override, then Analysis, then normalised
- [ ] Resolution is a function of a row's values alone, so that the badge, the ring and the API cannot disagree
- [ ] The fit fraction counts `required` Requirements only, scoring `have` as one and `partial` as one half
- [ ] A Requirement list with no `required` entries yields an absent fraction, not zero
- [ ] Tests cover normalisation cases, every combination of the three readings, the half weight, the empty case and the no-required case
