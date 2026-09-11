# 02: AI Usage, and the daily count becomes plumbing

**What to build:** A monthly token meter beside the existing daily Model Call
count, with every current call site reporting its tokens into it. Implements
ADR-0009.

**Blocked by:** —

**Status:** ready-for-agent

- [x] A monthly usage table keyed by `(user_id, month)`, upserted in one statement with the new total read back from the write — the same concurrency argument `countModelCall` already makes, for the same reason
- [x] `apps/web/lib/ai-usage/` holds the meter: a function to record tokens for a user, and one to answer whether they may start a call
- [x] Tokens recorded are everything the provider reports: `promptTokenCount`, `candidatesTokenCount` and `thoughtsTokenCount`. Thinking is billed and must not be silently excluded
- [x] Extraction, CV reading and Analysis all record their usage. A meter that counts one of four calls is a lie about the other three
- [x] `MONTHLY_AI_USAGE_LIMIT` is a token figure, with a comment recording what it was sized against. Confirm it against current Gemini 2.5 Pro pricing before shipping rather than inheriting the spec's guess
- [x] The limit is checked before a call starts and never mid-call; a call admitted within the limit is allowed to finish and overshoot (ADR-0009)
- [x] A spent monthly allowance answers with its own status and a reason distinguishable from a spent daily count
- [x] `DAILY_MODEL_CALL_LIMIT` rises from 100 to 300; its comment is updated to say it now exists *only* to cap what a leaked Personal Access Token can spend in a day
- [x] `Model Call` keeps its name in every identifier, comment and table mapping. This issue renames nothing
- [x] The one user-visible mention of the old wording — "Analysing spends one call from today's allowance" in `analysis.tsx` — is rewritten to speak of AI Usage
- [x] Unit tests stand at both limits without spending hundreds of round trips to walk there, as `setModelCallCount` already allows for the daily one

## Comments

Implemented on `main`. The monthly table is `ai_usage` in
`apps/web/lib/db/schema.ts` (migration `0010_bitter_epoch.sql`); the meter is
`apps/web/lib/ai-usage/` — `repository.ts` for the upsert-and-read-back,
`meter.ts` for `MONTHLY_AI_USAGE_LIMIT` and `mayStartAiCall`, `metered.ts` for
`Metered<Answer>` and `tokensReported`.

`MONTHLY_AI_USAGE_LIMIT` is 3,000,000 tokens, sized against Gemini 2.5 Pro's
published rates confirmed at ai.google.dev/gemini-api/docs/pricing on
2026-09-11 ($1.25/M input, $10.00/M output with thinking billed as output) —
about ten dollars a month at this product's input-heavy mix.

Two decisions beyond the literal checklist, both following ADR-0009:

- Extraction, CV reading and Analysis now *check* the monthly limit as well as
  recording into it. A limit only the Conversation endpoints honoured would not
  be a limit on AI Usage.
- Extraction answers a closed union, so a spent month needed a reason of its
  own: `ai_usage_spent` joins `ExtractionFailureReason`, and the extension's
  side panel words it as a month ending rather than as a fault.

The daily refusals were reworded too: `MODEL_CALL_CEILING_MESSAGE` now says a
precaution against a runaway client or a leaked token, rather than inviting the
user to wait, which is what ADR-0009's Consequences ask for.
