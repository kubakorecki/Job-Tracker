# 05: Requirements on a Job Application, editable

**What to build:** Requirements are stored against a Job Application, come back with it, and can be corrected, added and removed by hand — including for a Job Application that never came from a Posting.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Creating a Job Application accepts a Requirement list, and omitting it means an empty list rather than an error
- [ ] Reading a Job Application returns its Requirements
- [ ] Updating a Job Application can add a Requirement, remove one, change a skill's wording and change a Necessity
- [ ] A Requirement with an unknown Necessity is refused with a message naming the accepted values
- [ ] A Job Application with no Posting can carry Requirements, entered by hand
- [ ] The detail page has a Requirements section, grouped under the three Necessities, where each can be edited and removed and a new one added
- [ ] A Job Application with no Requirements says so, rather than showing an empty group
- [ ] Requirements are scoped to their Job Application, and therefore to its user — a request cannot reach another user's
- [ ] Tests go through the Job Applications endpoints, covering create with and without Requirements, each kind of edit, the unknown-Necessity refusal, and tenant isolation
