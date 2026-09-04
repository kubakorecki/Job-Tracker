# 13: The Analysis

**What to build:** A deeper check the user triggers on one Job Application. The model reads the Requirements against the Profile's text and answers each one with a Coverage and a line of reasoning — which is what a string comparison cannot do for "5+ years of React" against four years on a CV.

**Blocked by:** 05, 08, 10

**Status:** ready-for-agent

- [ ] Its own module and its own route, kept apart from the general Job Application endpoints so a future entitlement check has one home
- [ ] Runs only when the user asks; nothing triggers it automatically
- [ ] Takes the Job Application's Requirements and the Profile's extracted text, and returns a Coverage and a one-line reason per Requirement
- [ ] Can answer `partial`, which is the reading that justifies the whole feature
- [ ] Its own prompt and response schema, sharing nothing with job extraction or CV reading but the provider boundary
- [ ] The result is stored with Basis `profile`, alongside when it ran, so that reopening the Job Application spends nothing
- [ ] An analysed reading supersedes the normalised one; both remain readable
- [ ] Spends from the shared daily budget, before the provider is reached
- [ ] A provider failure and a spent budget answer distinctly, and neither destroys a previous Analysis
- [ ] Staleness is derived, not stored: an Analysis is stale when the Profile or the Requirements changed after it ran
- [ ] Staleness is surfaced only while the Job Application's Status is `bookmarked` or `applied`
- [ ] Runs on one Job Application at a time; there is no bulk trigger
- [ ] Tests substitute the analyser and cover a full result, a `partial` verdict, supersession of the normalised reading, staleness on both triggers, staleness suppressed past `applied`, provider failure, exhausted budget and tenant isolation
