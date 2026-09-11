# 04: The Conversation provider

**What to build:** The one place this app asks the model to talk. Streaming,
substitutable, prose-only.

**Blocked by:** 03

**Status:** ready-for-agent

- [x] `apps/web/lib/conversations/provider.ts`, written against a substitutable type as `analyser.ts` and `reader.ts` are, so the endpoints can be exercised with no API key and no network
- [x] Its own `CONVERSATION_MODEL` constant, `gemini-2.5-pro`, with a comment giving the reason it is its own constant rather than shared — the same reason the existing three state
- [x] Streams via `generateContentStream`, yielding text chunks as they arrive
- [x] No response schema and no structured output. This is the one call in the product that returns prose; a schema here would be a form
- [x] Prior Messages are sent as conversation history in the provider's own multi-turn shape, not concatenated into one string
- [x] Reports usage from the final chunk's `usageMetadata`, covering prompt, candidate and thinking tokens
- [x] A stream that fails partway surfaces both what arrived and the failure, rather than throwing away the partial text
- [x] Shares nothing with extraction, CV reading or the analyser but the boundary. It has its own model, its own instructions and its own reply shape; the four are not to be refactored together

## Comments

Implemented on `feat/chat` as `apps/web/lib/conversations/provider.ts`, with
`provider.test.ts` covering both halves that need no network. Nothing outside
the module changed.

The substitutable type is `StreamConversation`: one turn in
(`{ instructions, priorMessages, said }`), a `StreamedReply` out. `said` is
separate from `priorMessages` so that what is being answered is a fact about
the request rather than a convention about the last element of an array, and
`PriorMessage` is `Pick<Message, "role" | "text">` — structural, so a
repository row satisfies it, and carrying no ids, so a provider cannot name
one. The doc warns the consumer of the one thing it can get wrong: ticket 05
persists the user's Message *before* it assembles, so a caller that re-read the
Conversation after that write would pass the just-said Message twice.

A `StreamedReply` is an `AsyncGenerator<string, void>` with a `soFar()` on it,
and that accessor is the whole of how a turn is read. The first design returned
`Metered<string>` as the generator's return value, which looked tidy and lost
the reply in the likeliest failure there is: a browser that goes away takes the
endpoint's own loop down with it, and a reply readable only through a return
value or a thrown error would have had its prose and its tokens trapped in a
generator nobody is stepping any more — exactly the case story 23 promises to
keep. The running total now lives outside the generator so it outlives it, and
a reply that finished, one that broke off, and one the caller abandoned all
leave the same two facts in the same place. There is a test for each.

Everything that goes wrong leaves as one error, `PartialReply`, carrying
neither prose nor tokens of its own — both are on `soFar()`, and one fact in
two places is one fact that can disagree with itself. It covers a stream that
broke off, one that never reached the provider, and one that ran to its end
having said nothing (a model stopped by its own safety filter). Whether any
prose arrived is what tells story 22's "could not be reached" from story 23's
"broke off halfway", so the caller's rule is the same whatever it caught. An
earlier version had this sharing a `BilledFailure` base with `UnreadableAnswer`
in `lib/ai-usage/metered.ts` so `tokensSpentBy` would count it; with the tokens
on `soFar()` that base earned nothing, and `metered.ts` is untouched.

Two further things came out of building it. The stream's iterator is stepped by
hand rather than with `for await`, so the `yield` sits outside the `try`: a
caller that throws while handling a chunk has that thrown back in at the yield,
and a `try` around it would have dressed the caller's own failure up as the
provider's. And Gemini's streamed `usageMetadata` is cumulative rather than
per-chunk, so the reader keeps the last figure reported rather than summing
them — summing would count the prompt once per chunk, and keeping the last is
what lets a stream that broke off still report the prompt and thinking it was
billed for.

One rule is read in both directions: a Message of nothing but whitespace is not
sent back as a turn the model took, and a reply of nothing but whitespace is
not a reply. Without both halves a blank reply would be persisted and then
vanish from the next turn — the blank turn, a turn later.

No response schema, no `responseMimeType`, no tools and no function
declarations. The instructions are passed through exactly as `context.ts`
assembled them; nothing in the provider adds a word to them, so there stays one
place that decides what the model is told.

Not covered by a test, in line with the other three providers: the
`generateContentStream` call itself. There is no client seam in any of the four
— `analyseWithGemini` and `readCvWithGemini` are substituted whole by the
endpoints that use them, and this is substituted the same way. What the SDK
returns is checked by the compiler instead: `yield* stream` type-checks only
because a `GenerateContentResponse` satisfies `ReplyChunk`.
