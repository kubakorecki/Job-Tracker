# 02: Requirements and Necessity replace keywords

**What to build:** The shared contract stops describing a Posting's asks as a flat `keywords` array and starts describing them as Requirements, each carrying a Necessity. Existing rows keep their data. This is the cut every other issue in this effort depends on.

**Blocked by:** —

**Status:** ready-for-agent

- [ ] `Necessity` is a closed set of `required`, `preferred` and `unstated` in the shared contract, in the same style as `JobStatus` and `RemoteType`
- [ ] `Coverage` is a closed set of `have`, `partial` and `missing` in the shared contract
- [ ] `Basis` is a closed set of `profile` and `tailored-cv` in the shared contract
- [ ] A Requirement is a skill string plus a Necessity; a Job Application carries a list of them in place of `keywords`
- [ ] `keywords` is removed from the contract entirely — no alias, no deprecation window, no acceptance of it on write
- [ ] The database enums are derived from the contract's sets rather than retyped, so that adding a value is a migration rather than a silent drift
- [ ] A migration creates a Requirements table, one row per Requirement of one Job Application, and folds every existing `keywords` entry into a Requirement with Necessity `unstated`
- [ ] The migration drops the `keywords` column only after the fold
- [ ] Requirement rows carry the Basis of their Coverage readings; nothing in this effort writes anything but `profile`
- [ ] The Requirements table holds the three Coverage readings side by side — normalised, analysed with its reason, and overridden — each nullable
