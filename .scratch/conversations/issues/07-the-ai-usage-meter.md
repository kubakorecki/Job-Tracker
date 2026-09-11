# 07: The AI Usage meter on the Profile

**What to build:** The one place the user sees what they have spent.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] A meter on `/settings/profile` showing this month's AI Usage against the monthly limit
- [ ] Reads in tokens, and says in words what a token is spent on — reading a Posting, reading a CV, an Analysis, a Conversation — so the number is legible to someone who has never thought about tokens
- [ ] States when the month resets
- [ ] Readable without relying on colour alone, as the fit ring already is
- [ ] Says plainly when the allowance is spent, and that the month rather than a fault is the reason
- [ ] Nothing anywhere shows, names or implies the daily Model Call count (ADR-0009)
- [ ] Follows `docs/design-system.md` for tokens, type and voice
