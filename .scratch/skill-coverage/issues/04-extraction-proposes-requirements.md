# 04: Extraction proposes Requirements with a Necessity

**What to build:** When the extension reads a Posting, the Draft it proposes carries Requirements marked required, preferred or unstated — instead of a flat keyword list that cannot say which.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] The provider's response schema stays flat — no nested objects and no `anyOf` — because only a subset of JSON Schema is accepted and a nested schema is rejected outright
- [ ] Requirements come back from the provider as three parallel arrays of strings, one per Necessity
- [ ] The function that already folds the provider's reply into a Draft folds those three arrays into one tagged Requirement list
- [ ] The prompt instructs that a skill listed without a stated preference is `unstated`, and that nothing is to be guessed upward into `required`
- [ ] Technologies, practices, qualifications, languages and quantities of experience all count as Requirements
- [ ] A Posting that lists none produces an empty Requirement list, which is a normal outcome and not a failure
- [ ] The existing extraction failure cases — no job found, provider error, rate limited — are unchanged
- [ ] Tests substitute the provider and cover a Posting with all three Necessities, one with only unstated Requirements, and one with none
