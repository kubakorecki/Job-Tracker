# 05: The Conversation endpoints

**What to build:** Three routes: say something, read it back, clear it.

**Blocked by:** 01, 02, 04

**Status:** ready-for-agent

- [x] `POST /api/conversations/:scope/messages` streams a reply
- [x] `GET /api/conversations/:scope` returns the Messages oldest-first (ticket 06 widened this to `{ messages, cvAttached }`; see its comments)
- [x] `DELETE /api/conversations/:scope/messages` clears the Conversation, keeping the row
- [x] `:scope` is a Job Application id or the literal `general`. Anything else is a 404, as is a Job Application id the user does not own — the same not-found-rather-than-forbidden shape the Tailored CV endpoints already use
- [x] Turn order is: authenticate, resolve the Conversation, check AI Usage, spend the Model Call, persist the user's Message, assemble, stream, persist the model's reply, record tokens
- [x] The Model Call is spent before the provider is reached, so a call that reached it counts whether or not it came back — the existing rule in `spendModelCall`
- [x] A spent AI Usage allowance refuses before anything is persisted, with a reason the panel can tell apart from a provider failure
- [x] A stream that fails partway persists what arrived, marked as incomplete
- [x] Endpoints take their provider and their assemblers as substitutable arguments, so every path above is testable with no API key, no bucket and no network
- [x] Tests cover: a first turn creating a Conversation, a follow-up carrying history, a spent allowance, a provider failure, a mid-stream failure, an unowned Job Application, and a bad scope

## Comments

Implemented on `feat/chat`. The three handlers are
`apps/web/lib/conversations/api.ts`, wired at
`app/api/conversations/[scope]/route.ts` (GET) and
`.../[scope]/messages/route.ts` (POST, DELETE), with 34 tests in `api.test.ts`
covering every path through a turn against real rows and no network.

`:scope` resolves in one place: the literal `general`, or a Job Application id
this user owns. A scope that is neither — a stranger's id, a word, a malformed
uuid — is one answer, `No such Conversation.` at 404, so the API never confirms
a stranger's row is real. It is the Conversation that is reported missing
rather than the Job Application, because a Conversation is what the address is
for.

Four things beyond the literal checklist, each because the alternative was
worse:

- **A Message says whether it is all of what was meant to be said.** "Marked as
  incomplete" needed somewhere to be marked, and the panel reopens tomorrow: a
  warning delivered only in the response that broke would leave a truncated
  reply reading as the model's considered answer. `Message.incomplete` joins
  the contract, the column joins `messages` (migration `0011_exotic_the_order`,
  applied to the dev project), and `appendMessage` takes it. It is required
  rather than optional so a reader cannot mistake a missing field for a reply
  that finished.
- **The turn's wire shape is stated in `contract.ts`.** Newline-delimited JSON,
  four events: `asked` (the user's Message as it was written down), `wrote`
  (prose as it arrives), and exactly one ending — `finished` or `broke-off`,
  each carrying the persisted Message. Both endings carry the row rather than
  leaving the panel to assemble one from the pieces it drew, so what it shows
  after a turn and what it shows tomorrow come from one place. `EventSource`
  cannot make a `POST`, so the panel reads the body either way and a line of
  JSON needs no framing rules of its own.
- **A Message is bounded at 20,000 characters.** An unbounded body is an
  unbounded prompt, and everything the model needs was assembled by the server
  and was never the user's to paste in (ADR-0008).
- **Nothing is persisted by a refused turn, including the Conversation.** The
  ticket's order has resolving the Conversation before the limits, and
  `conversationFor` creates on read — so the row is found after the two
  refusals instead, and a turn nobody is allowed to take leaves nothing behind
  it at all. Reading and clearing still create on read, which is ticket 01's
  own arrangement.

The two failures the user has to tell apart are decided by whether any prose
arrived, which is the rule ticket 04 states from the other side. The first
prose is waited for _before_ a response exists: nothing arrived is an ordinary
502 with a sentence, and prose that stops later is a `broke-off` event on a
stream that has already begun, because by then there is no status left to
answer with. "Prose" is the provider's own test rather than "a chunk" — a reply
of nothing but whitespace is not a reply, so a stream that has sent only blank
chunks is waited on rather than answered, and a reply that opens with a blank
chunk still keeps every character that led up to its first word. A review
caught that one: testing the chunk would have persisted an empty Message and
called it a reply.

The writing-down lives in `stream.ts` rather than in the handler, because when
a reply is streaming it is the only thing still running. A browser that goes
away cancels the response, and the generator's `finally` is what keeps the
paragraph that had arrived — which is also why the stream is begun in `start`
rather than on the first read: a generator that had never begun has no
`finally` to run, and a reader that went away without reading a byte would take
the paragraph with it. Three endings, one write, and the tokens recorded after
the prose they paid for is safely stored.

Assembly is two seams, `assembleAttached` and `assembleGeneral` in
`assembly.ts`: the half that reads the rows, kept apart from `context.ts`,
which is the pure half that decides what the model is told. Both are arguments
to the endpoint, as the provider is. The tests leave them real unless the test
is about them — what the prompt says is `context.test.ts`'s business, and
asserting it twice would be two places to change when a sentence moves.

Ticket 06 widened the read: `GET /api/conversations/:scope` answers
`{ messages, cvAttached }` rather than a bare `Message[]`. The panel has to say
plainly that no CV is attached at the moment it opens, and that is a fact about
what the Conversation can see rather than a second thing to go and ask for.
