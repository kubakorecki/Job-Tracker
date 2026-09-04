# 04: Extraction proposes Requirements with a Necessity

**What to build:** When the extension reads a Posting, the Draft it proposes carries Requirements marked required, preferred or unstated — instead of a flat keyword list that cannot say which.

**Blocked by:** 02

**Status:** ready-for-agent

- [x] The provider's response schema stays flat — no nested objects and no `anyOf` — because only a subset of JSON Schema is accepted and a nested schema is rejected outright
- [x] Requirements come back from the provider as three parallel arrays of strings, one per Necessity
- [x] The function that already folds the provider's reply into a Draft folds those three arrays into one tagged Requirement list
- [x] The prompt instructs that a skill listed without a stated preference is `unstated`, and that nothing is to be guessed upward into `required`
- [x] Technologies, practices, qualifications, languages and quantities of experience all count as Requirements
- [x] A Posting that lists none produces an empty Requirement list, which is a normal outcome and not a failure
- [x] The existing extraction failure cases — no job found, provider error, rate limited — are unchanged
- [x] Tests substitute the provider and cover a Posting with all three Necessities, one with only unstated Requirements, and one with none

## Comments

Implemented. The response schema now asks for `requiredSkills`, `preferredSkills`
and `unstatedSkills` — three arrays of bare strings beside the eight primitives,
still flat, still no `anyOf`. The Necessity is carried by which array a skill
arrived in, because a list of tagged objects is exactly the nested shape Gemini
rejects. `readDraft` folds them in `Necessity` order, so the hard Requirements
lead the list before anything groups them.

Two naming decisions worth recording:

- **The properties are keyed by Necessity, not listed by hand.** The map
  ``satisfies Record<`${Necessity}Skills`, FlatProperty>``, so a fourth
  Necessity added to the closed set is a type error here rather than a
  Necessity the model is never given anywhere to put — the same trap
  `DRAFT_PROPERTIES` already sets for a field added to `JobExtraction`.
- **The `Skills` suffix is deliberate.** A property called `required` sitting
  inside a JSON Schema's `properties` reads as the schema keyword of the same
  name, to a reader and plausibly to the model.

A Posting that asks for nothing comes back with the `requirements` field absent
rather than as an empty array, which is what every other field the page did not
state does. The Job Application made from such a Draft still has an empty
Requirement list: the contract's create defaults fill it. "Nothing asked" is a
success like any other — only an empty company _and_ title mean the page was not
a Posting, which is untouched, as are `provider_error` and `rate_limited`.

The prompt gained one paragraph: what counts as a Requirement (technologies,
practices, qualifications, languages, quantities of experience such as "5+ years
of backend"), which list each belongs in, and that a skill listed without a
stated preference is `unstated` and is never moved up into `requiredSkills` for
sounding important or being mentioned first. The twelve-skill cap moved from the
one array to the three lists together.

`lib/extraction/api.ts` is unchanged: the endpoint never read a Requirement's
shape, and the Draft it passes through is the same type it always was.
