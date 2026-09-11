# 05: The Conversation endpoints

**What to build:** Three routes: say something, read it back, clear it.

**Blocked by:** 01, 02, 04

**Status:** ready-for-agent

- [ ] `POST /api/conversations/:scope/messages` streams a reply
- [ ] `GET /api/conversations/:scope` returns the Messages oldest-first
- [ ] `DELETE /api/conversations/:scope/messages` clears the Conversation, keeping the row
- [ ] `:scope` is a Job Application id or the literal `general`. Anything else is a 404, as is a Job Application id the user does not own — the same not-found-rather-than-forbidden shape the Tailored CV endpoints already use
- [ ] Turn order is: authenticate, resolve the Conversation, check AI Usage, spend the Model Call, persist the user's Message, assemble, stream, persist the model's reply, record tokens
- [ ] The Model Call is spent before the provider is reached, so a call that reached it counts whether or not it came back — the existing rule in `spendModelCall`
- [ ] A spent AI Usage allowance refuses before anything is persisted, with a reason the panel can tell apart from a provider failure
- [ ] A stream that fails partway persists what arrived, marked as incomplete
- [ ] Endpoints take their provider and their assemblers as substitutable arguments, so every path above is testable with no API key, no bucket and no network
- [ ] Tests cover: a first turn creating a Conversation, a follow-up carrying history, a spent allowance, a provider failure, a mid-stream failure, an unowned Job Application, and a bad scope
