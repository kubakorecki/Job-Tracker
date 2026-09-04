# 03: One daily budget for every model call

**What to build:** The per-user daily counter currently counts job extractions. Reading a CV and running an Analysis are also model calls against the same API key and the same grant, and should spend from the same allowance.

**Blocked by:** —

**Status:** ready-for-agent

- [x] The counter is spent by job extraction, by reading a CV, and by an Analysis, from one shared daily limit
- [x] The limit remains one hundred per user per day, and the day remains UTC
- [x] Spending stays a single upsert that increments and reads back the new total, so that concurrent requests cannot both find room
- [x] A call is spent before the provider is reached, not after, so that a request which reached the provider counts whether or not it returned anything
- [x] Exceeding the limit refuses with the same status the extraction endpoint already uses, from every caller
- [x] The comments and the shared vocabulary around the counter stop describing it as counting extractions and start describing it as counting model calls
- [x] The table itself is not renamed — the name is not worth a migration
- [x] Tests cover a spend from each of the three callers exhausting the same allowance

## Comments

**Implemented.** The budget is now `apps/web/lib/model-calls/`, split the way
the rest of the backend is: `repository.ts` holds the upsert (unchanged in
substance — one statement that increments and returns the new total),
`budget.ts` holds `DAILY_MODEL_CALL_LIMIT`, the shared refusal status and
`spendModelCall`, which answers `"spent"` or `"over-limit"` and is what every
caller uses. Job extraction was moved onto it and no longer owns a limit of its
own. The Drizzle export is `modelCallUsage`; the table is still
`extraction_usage`, with a comment saying why.

`CONTEXT.md` gained a **Model Call** entry, since the vocabulary was the point
of the ticket and the glossary is where it has to broaden.

**On the last box.** Only one of the three callers exists today — the CV reader
lands with 08 and the Analysis with 13, both of which already say they spend
from this budget. So the three-caller exhaustion is proved at the seam all
three use (`lib/model-calls/budget.test.ts`: three spends draw down one
allowance and the fourth is refused), and the endpoint-level version of it is
part of 08 and 13's own test lists. Nothing else could be written now without
inventing the endpoints.
