# 04: The Conversation provider

**What to build:** The one place this app asks the model to talk. Streaming,
substitutable, prose-only.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] `apps/web/lib/conversations/provider.ts`, written against a substitutable type as `analyser.ts` and `reader.ts` are, so the endpoints can be exercised with no API key and no network
- [ ] Its own `CONVERSATION_MODEL` constant, `gemini-2.5-pro`, with a comment giving the reason it is its own constant rather than shared — the same reason the existing three state
- [ ] Streams via `generateContentStream`, yielding text chunks as they arrive
- [ ] No response schema and no structured output. This is the one call in the product that returns prose; a schema here would be a form
- [ ] Prior Messages are sent as conversation history in the provider's own multi-turn shape, not concatenated into one string
- [ ] Reports usage from the final chunk's `usageMetadata`, covering prompt, candidate and thinking tokens
- [ ] A stream that fails partway surfaces both what arrived and the failure, rather than throwing away the partial text
- [ ] Shares nothing with extraction, CV reading or the analyser but the boundary. It has its own model, its own instructions and its own reply shape; the four are not to be refactored together
