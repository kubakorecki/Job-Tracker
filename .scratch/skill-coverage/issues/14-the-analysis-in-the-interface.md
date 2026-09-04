# 14: The Analysis in the interface

**What to build:** The button that runs it, the reasons it produces, and the banner that says the answer has gone out of date.

**Blocked by:** 13, 11

**Status:** ready-for-agent

- [ ] One clearly-labelled control on the Job Application detail page runs the Analysis
- [ ] A pending state while it runs, since the model call is not instant
- [ ] Each Requirement's reason is readable next to its badge
- [ ] The badge shows that a verdict came from the Analysis rather than the automatic comparison, and the affordance still reveals what the automatic comparison said
- [ ] A stale Analysis is shown greyed with a banner explaining why and offering a re-run
- [ ] Staleness is not shown once the Status has moved past `applied`
- [ ] A provider failure and a spent daily budget are reported in plain language, and distinguishably — one says try later, the other says the day's allowance is gone
- [ ] Nothing in the interface mentions plans, tiers or payment
