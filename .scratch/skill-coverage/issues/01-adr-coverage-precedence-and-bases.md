# 01: ADR — Coverage has three sources and two Bases

**What to build:** An ADR recording why one Requirement carries three Coverage readings in a precedence order, and why two Bases coexist rather than one superseding the other. A future reader looking at a table with `normalisedCoverage`, `analysedCoverage` and `overriddenCoverage` side by side will otherwise assume it is redundancy and collapse it.

**Blocked by:** —

**Status:** ready-for-agent

- [x] Lives in `docs/adr/`, numbered after the existing ADRs, following their format
- [x] States the decision: Coverage is reached by normalised comparison, Analysis and user override, in ascending precedence, and all three readings are kept rather than resolved at write time
- [x] States the second decision: Coverage is measured against a Basis — the Profile or the Tailored CV — and both readings coexist for one Requirement
- [x] Records the alternatives that were rejected: one resolved verdict with a provenance enum; the Tailored CV reading replacing the Profile reading outright
- [x] Records why keeping the Profile reading matters after a Tailored CV exists — it is what identifies a skill the user has but omitted from the CV they are sending
- [x] Records the consequence: resolution is a pure function of a row, and re-running an Analysis cannot destroy an override
- [x] Uses the vocabulary in `CONTEXT.md` throughout
