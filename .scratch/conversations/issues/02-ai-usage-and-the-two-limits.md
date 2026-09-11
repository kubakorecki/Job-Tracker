# 02: AI Usage, and the daily count becomes plumbing

**What to build:** A monthly token meter beside the existing daily Model Call
count, with every current call site reporting its tokens into it. Implements
ADR-0009.

**Blocked by:** —

**Status:** ready-for-agent

- [ ] A monthly usage table keyed by `(user_id, month)`, upserted in one statement with the new total read back from the write — the same concurrency argument `countModelCall` already makes, for the same reason
- [ ] `apps/web/lib/ai-usage/` holds the meter: a function to record tokens for a user, and one to answer whether they may start a call
- [ ] Tokens recorded are everything the provider reports: `promptTokenCount`, `candidatesTokenCount` and `thoughtsTokenCount`. Thinking is billed and must not be silently excluded
- [ ] Extraction, CV reading and Analysis all record their usage. A meter that counts one of four calls is a lie about the other three
- [ ] `MONTHLY_AI_USAGE_LIMIT` is a token figure, with a comment recording what it was sized against. Confirm it against current Gemini 2.5 Pro pricing before shipping rather than inheriting the spec's guess
- [ ] The limit is checked before a call starts and never mid-call; a call admitted within the limit is allowed to finish and overshoot (ADR-0009)
- [ ] A spent monthly allowance answers with its own status and a reason distinguishable from a spent daily count
- [ ] `DAILY_MODEL_CALL_LIMIT` rises from 100 to 300; its comment is updated to say it now exists *only* to cap what a leaked Personal Access Token can spend in a day
- [ ] `Model Call` keeps its name in every identifier, comment and table mapping. This issue renames nothing
- [ ] The one user-visible mention of the old wording — "Analysing spends one call from today's allowance" in `analysis.tsx` — is rewritten to speak of AI Usage
- [ ] Unit tests stand at both limits without spending hundreds of round trips to walk there, as `setModelCallCount` already allows for the daily one
