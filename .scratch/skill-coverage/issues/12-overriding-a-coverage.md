# 12: Overriding a Coverage

**What to build:** The user has the last word. Setting a Requirement's Coverage by hand beats both the automatic reading and the Analysis, survives a re-run, and can be reverted in one click.

**Blocked by:** 11

**Status:** ready-for-agent

- [ ] A Requirement's Coverage can be set by the user to any of `have`, `partial` or `missing`
- [ ] An override takes precedence over both other readings
- [ ] An override survives re-running the Analysis — the model cannot overwrite it
- [ ] An override can be cleared, after which the Requirement falls back to the Analysis, or to the normalised reading if none has run
- [ ] An override applies to the one Job Application it was set on, and never to another
- [ ] The badge shows visibly that a verdict is the user's rather than the tool's
- [ ] Setting an override to `have` offers a nudge to upload a CV that mentions the skill, since a repeated override is a sign the Profile is out of date
- [ ] Overrides are scoped to their user
- [ ] Tests cover setting each value, precedence over both other readings, survival across a re-run, clearing, and tenant isolation
