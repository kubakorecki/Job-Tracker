# Conversations

Status: ready-for-agent

## Problem Statement

The tracker holds everything needed to answer the questions a job search
actually turns on, and answers none of them in words. It knows what a Posting
asks for, down to whether each Requirement is insisted on or merely liked. It
knows what the user can do, from a CV they uploaded and a skill list they
curated. It has, where they asked for one, the model's own reading of one
against the other — a Coverage per Requirement, a Rating out of ten, and a
paragraph on what would raise it.

What it cannot do is be asked anything. Every model call in the product is a
form: a fixed input, a Zod-validated object, no follow-up. So the user reads a
Rating of 6 and a line saying the CV understates their infrastructure work, and
the next move — *then help me write the cover letter* — happens in a different
tab, against a model that knows none of it, with the CV and the Posting pasted
in by hand. The tracker has assembled exactly the context that makes the answer
good, and has no way to spend it.

The gap is a conversation. Not another structured reading, and not a second
Analysis: somewhere to ask, follow up, disagree, and ask again, with the CV and
the job already in the room.

## Solution

A **Conversation**: a durable record of the user talking to the model, reached
from a panel that opens on any signed-in page.

There are two kinds and no more, and which one the user is in is decided by
where they are standing rather than by picking from a list. On a Job
Application's page, the panel is that Job Application's Conversation, and it
sees that Job Application in full — its fields, its Posting description, its
Requirements with their Necessity and resolved Coverage, and its Analysis's
Rating and Feedback. Everywhere else — the board, the settings pages — the
panel is the one general Conversation, which sees every Job Application in
one-line outline and none in full. Both always see the Profile: the CV's text
and the accepted skill list. That is the whole of the routing, and there is no
switcher.

The model is given all of this and no tools. It cannot query, cannot fetch, and
cannot write: context is assembled by the server before the call, which is what
keeps tenant scoping where ADR-0001 put it and what stops a Posting's scraped
prose from reaching a model that could act on it (ADR-0008). A Conversation
advises and writes prose. It never changes a Status, never sets a Coverage, and
never attaches a document — a Status is the user's to set and an override is
the user's last word, and an assistant that moved either would be a fourth
precedence ADR-0004 never defined.

Replies stream, because the flagship use is a cover letter and a blank panel
for twenty seconds is a feature used once. A **Message** is prose and nothing
more: there is no Draft here, and a cover letter is something the user reads
and copies out rather than a document the product files under a new name.

Clearing a Conversation destroys its Messages. There is no archive and no
second Conversation of the same kind, because the Job Application already *is*
the scope, and a list of threads to name and manage is the question this design
exists to avoid asking.

Alongside it, spending on the model becomes visible. **AI Usage** is a monthly
token count — everything the provider reports, thinking included, across
extraction, CV reading, Analysis and every Conversation turn — metered against
a monthly limit and drawn on the Profile page. The existing daily Model Call
count stays at a raised ceiling and stops being mentioned to anyone: it caps
what a leaked Personal Access Token can spend in a day, which is a different
job that a monthly token limit cannot do (ADR-0009).

Both ADRs are already written: `docs/adr/0008-a-conversation-sees-only-what-the-server-assembled.md`
and `docs/adr/0009-two-limits-for-two-reasons.md`.

## User Stories

### Having a Conversation

1. As a job seeker, I want to open a chat panel from any signed-in page, so that asking a question never costs me my place.
2. As a job seeker, I want the panel on a Job Application to already know that job, so that I never paste a posting into a chat box again.
3. As a job seeker, I want it to already know my CV, so that advice about my experience is about *my* experience.
4. As a job seeker, I want it to know the Requirements and their Coverage, so that it can talk about the specific gaps the tracker already found.
5. As a job seeker, I want it to know my Analysis's Rating and Feedback, so that "help me fix this" continues a reading rather than starting one over.
6. As a job seeker, I want to ask it to write a cover letter, so that the thing I actually need is one sentence away.
7. As a job seeker, I want to follow up and have it remember what we just said, so that refining an answer does not mean restating the brief.
8. As a job seeker, I want replies to appear as they are written, so that a long answer feels like it is happening rather than hanging.
9. As a job seeker, I want to copy a reply in one action, so that getting a cover letter into a document is not a drag-select.
10. As a job seeker, I want the panel to close and reopen with my Conversation intact, so that I can go and look at something and come back.
11. As a job seeker, I want the Conversation still there tomorrow, so that a week of applying is one continuing thought rather than a series of fresh starts.

### Which Conversation I am in

12. As a job seeker, I want each Job Application to have its own Conversation, so that advice about one job is never muddled with another.
13. As a job seeker, I want one general Conversation everywhere else, so that "which of these should I chase this week?" has somewhere to be asked.
14. As a job seeker, I want the general Conversation to know all my Job Applications in outline, so that it can answer across my pipeline.
15. As a job seeker, I want to be told plainly when the general Conversation cannot see a job's full description, so that a limit reads as a limit rather than as the model being vague.
16. As a job seeker, I want no thread picker anywhere, so that there is never a question of which chat I am in.
17. As a job seeker, I want to clear a Conversation, so that a line of thinking that went nowhere can be abandoned.
18. As a job seeker, I want clearing to warn me first, so that a week of work is not one misclick from gone.

### When something is missing

19. As a job seeker with no CV uploaded, I want the panel to say so and link me to my Profile, so that I find out before I trust an answer rather than after.
20. As a job seeker with no CV uploaded, I want to be able to chat anyway, so that a general question is not gated behind an upload.
21. As a job seeker, I want a Job Application with no description to still be discussable, so that a job I entered by hand is not a dead panel.
22. As a job seeker, I want a clear message when the model cannot be reached, so that I know to try again rather than assuming the answer was silence.
23. As a job seeker, I want a reply that fails halfway to keep what it had written, so that a dropped connection does not throw away a good first paragraph.

### What it will not do

24. As a job seeker, I want the Conversation never to change my Status, so that where a job sits in my pipeline stays something I said.
25. As a job seeker, I want it never to overwrite a Coverage or an override, so that my last word stays my last word.
26. As a job seeker, I want it never to attach or replace a document, so that what I am sending is only ever what I chose.

### What it costs

27. As a job seeker, I want to see how much of my monthly AI Usage I have spent, so that I know where I stand before starting something long.
28. As a job seeker, I want that meter to count everything — extraction, CV readings, Analyses and chat alike, so that one number means what I have spent.
29. As a job seeker, I want to be told clearly when my AI Usage is spent, so that I know it is the month rather than a fault.
30. As a job seeker, I want a reply that started within my limit to finish, so that I am not cut off mid-sentence over an accounting boundary.
31. As a job seeker, I never want to hear about a daily call limit, so that the thing protecting me from a stolen token does not read as a rationing of my own tool.

## Implementation Decisions

### Contract and storage

- `Conversation` and `Message` are added to `packages/schema`. A Conversation
  carries the user, an optional Job Application id, and its timestamps. A
  Message carries its Conversation, a `role` of `user` or `model`, its text,
  and when it was said.
- The optional Job Application id *is* the routing: `null` is the general
  Conversation. A partial unique index on `(user_id)` where the id is null, and
  a unique index on `(user_id, job_application_id)`, are what enforce "two kinds
  and no more" in the database rather than in a comment.
- Both tables carry `user_id` like every other table, and every query lives in
  a repository module taking it as a non-optional first argument (ADR-0001).
- Deleting a Job Application deletes its Conversation. Clearing a Conversation
  deletes its Messages and keeps the row, so the two operations stay distinct.
- Nothing marks a Conversation stale. Each turn is assembled from the state of
  that moment, and a Message is a record of something said rather than a claim
  still being made — the opposite of an Analysis, deliberately (`CONTEXT.md`).

### What reaches the model

- Two assemblers, one per kind, both pure functions from rows already read to a
  prompt. No tools, no function declarations, no query access (ADR-0008).
- The attached assembler sends the Job Application in full, including its
  description, its Requirements with Necessity and *resolved* Coverage — the
  same resolution function the badge and the ring use, never a re-implementation
  — and the Analysis's Rating and Feedback where one exists.
- The general assembler sends one line per Job Application: company, title,
  status, fit fraction, closing. Descriptions are stripped. It is roughly thirty
  tokens each, so a large pipeline is single-digit thousands.
- Both send the Profile's CV text and accepted skill list. Neither sends a
  Tailored CV's text; that one is named as attached and nothing more (ADR-0004,
  ADR-0008).
- Everything drawn from a Posting — the description, the Requirements' wording —
  is fenced in the prompt and labelled as text quoted from a third-party website
  rather than as instruction. With no tools this is defence in depth rather than
  the only defence, which is the order those two should come in.

### The provider

- `apps/web/lib/conversations/provider.ts`, written against a substitutable
  type as `analyser.ts` and `reader.ts` are, so the endpoints are exercisable
  with no API key and no network.
- Its own `CONVERSATION_MODEL` constant, set to `gemini-2.5-pro`. Its own
  constant rather than a shared one for the reason the existing three give:
  these are different jobs that may want different models, and a shared name is
  how they stop being able to differ. Verify the model id against
  ai.google.dev before changing it, as the existing comments do.
- Streaming via `generateContentStream`. Usage is read from the final chunk's
  `usageMetadata` — `promptTokenCount`, `candidatesTokenCount`,
  `thoughtsTokenCount` — and recorded once the stream ends.
- No structured output and no response schema. This is the one call in the
  product that returns prose, and giving it a schema would be giving it a form.

### Endpoints

- `POST /api/conversations/:scope/messages` streams a reply.
  `GET /api/conversations/:scope` reads the Messages back.
  `DELETE /api/conversations/:scope/messages` clears it. `:scope` is a Job
  Application id or the literal `general`.
- Order of operations on a turn: authenticate, resolve the Conversation,
  check AI Usage, spend the Model Call, persist the user's Message, assemble,
  stream, persist the model's Message, record usage. The Model Call is spent
  before the provider is reached — the existing rule in `spendModelCall`, and
  the reason it is written that way.
- A stream that fails partway persists what arrived, with the failure marked on
  the Message so the panel can show it against the partial text.

### AI Usage

- A new monthly token table keyed by `(user_id, month)`, upserted in one
  statement and read back from the write, in the same shape as the daily
  counter for the same concurrency reason.
- Every existing call site — extraction, CV reading, Analysis — records its
  tokens too. All four report usage or the meter is a lie about three of them.
- `MONTHLY_AI_USAGE_LIMIT` is a token figure, checked before a call starts and
  never mid-stream. Confirm the number against current Gemini 2.5 Pro pricing
  before it ships rather than inheriting the one in this spec.
- `DAILY_MODEL_CALL_LIMIT` rises from 100 to 300 and loses its last user-visible
  mention. `Model Call` keeps its name everywhere in the code, because it is
  precisely accurate for a thing that counts calls (ADR-0009).

### The panel

- An overlay drawer from the right — `paper-raised` over the page's `paper`,
  with a `border-line` edge. No shadow: there is no shadow anywhere in this
  system, which rules out the floating card most chat widgets default to.
- Opened from the `AppBar`, which is the one thing on every signed-in page. It
  is not the `action` slot: that is the page's own primary thing to do, and the
  panel belongs to every page rather than to one.
- Full-width on small viewports. The board is a horizontally scrolled column
  layout and a pushing rail would reflow it on every question.
- Streams into the last Message as it arrives. A copy affordance on every model
  Message.
- Follows `docs/design-system.md` for tokens, type and voice.

## Out of Scope

- **Any writing to the record.** No Status changes, no Coverage, no
  attachments. Argued against permanently in the Solution above, not merely
  deferred.
- **Generating a Tailored CV.** `CONTEXT.md` has promised this since before the
  code existed, and a Conversation that writes a cover letter sits right beside
  it, but attaching a generated document is rung two and a separate effort.
- **Tool calling.** The seam is named in ADR-0008 — one tool that opens a Job
  Application in full — and deliberately unbuilt.
- **The extension side panel.** Its job is capture, not conversation.
- **Multiple Conversations of one kind, archives, titles, or search.** A
  `conversation_id` on a Message is all it would take later; nothing is paid for
  it now.
- **Billing.** AI Usage is metered and shown. Nothing charges, and the Pro seam
  is the same one Analysis already sits behind.
