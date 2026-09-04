# 03: One daily budget for every model call

**What to build:** The per-user daily counter currently counts job extractions. Reading a CV and running an Analysis are also model calls against the same API key and the same grant, and should spend from the same allowance.

**Blocked by:** —

**Status:** ready-for-agent

- [ ] The counter is spent by job extraction, by reading a CV, and by an Analysis, from one shared daily limit
- [ ] The limit remains one hundred per user per day, and the day remains UTC
- [ ] Spending stays a single upsert that increments and reads back the new total, so that concurrent requests cannot both find room
- [ ] A call is spent before the provider is reached, not after, so that a request which reached the provider counts whether or not it returned anything
- [ ] Exceeding the limit refuses with the same status the extraction endpoint already uses, from every caller
- [ ] The comments and the shared vocabulary around the counter stop describing it as counting extractions and start describing it as counting model calls
- [ ] The table itself is not renamed — the name is not worth a migration
- [ ] Tests cover a spend from each of the three callers exhausting the same allowance
