# 11: Coverage on the Job Application

**What to build:** Every Requirement on the detail page shows whether the Profile covers it, computed automatically and for free, with the reading visible the moment a Posting is saved.

**Blocked by:** 05, 08, 10

**Status:** ready-for-agent

- [ ] Reading a Job Application returns each Requirement's resolved Coverage and the readings behind it
- [ ] The normalised reading is computed against the Profile's accepted skill list and recorded with Basis `profile`
- [ ] It is recomputed when Requirements change and when the Profile's skills change, and costs no model call
- [ ] The detail page shows Requirements grouped by Necessity, each with a Coverage badge
- [ ] Each badge has an affordance revealing all three readings, so a surprising verdict can be understood
- [ ] A Job Application with no Requirements shows the empty state rather than a comparison
- [ ] A user with no Profile is told what to do, rather than shown every Requirement as missing
- [ ] Tests go through the Job Applications endpoints, covering Coverage present, Coverage after a Requirement edit, and the no-Profile case
