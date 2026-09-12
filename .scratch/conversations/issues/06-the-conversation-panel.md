# 06: The Conversation panel

**What to build:** The drawer, on every signed-in page, showing the
Conversation for wherever the user is standing.

**Blocked by:** 05

**Status:** ready-for-agent

- [x] An overlay drawer from the right: `paper-raised` over the page's `paper`, with a `border-line` edge and no shadow — there is no shadow anywhere in this system
- [x] Opened from the `AppBar`, which is the one thing on every signed-in page. Not via its `action` slot: that is the page's own primary thing to do, and this belongs to every page
- [x] Which Conversation it shows is decided by the route alone — the Job Application's on `/dashboard/job-applications/[id]`, the general one everywhere else. No switcher and no picker anywhere in the UI
- [x] The header says which Conversation this is, so the scope is visible without being selectable
- [x] Full-width on small viewports; an overlay rather than a pushing rail, because the board is a horizontally scrolled column layout that must not reflow on every question
- [x] Replies stream into the last Message as they arrive
- [x] Every model Message has a copy affordance — the cover letter is the point, and a drag-select is not a feature
- [x] Closing and reopening, and navigating away and back, leave the Conversation intact
- [x] With no CV on the Profile: the panel opens, says plainly that no CV is attached, links to `/settings/profile`, and still allows chatting
- [x] A spent AI Usage allowance, an unreachable provider, and a mid-stream failure each read differently and each say what to do; a partial reply keeps its text with the failure shown against it
- [x] Clearing asks first, and says that the Messages will not be recoverable
- [x] The daily Model Call limit is never mentioned in any string
- [x] Follows `docs/design-system.md` for tokens, type and voice

## Comments

Implemented on `feat/chat`. The panel is `apps/web/app/conversation-panel.tsx`
hung off the `AppBar`, over three tested modules in `lib/conversations/`:
`scope.ts` (which Conversation the address names), `turn.ts` (what the panel
shows, as pure transitions) and `client.ts` (the three addresses, and the
reading of a streamed turn). 30 tests across the three, and `api.test.ts` grew
two for the read's new shape.

The split is where it is because `vitest` here runs `lib/**` and there is no
component test in this repo. Everything that can be got wrong without being
seen was pushed below the component: that a reply streams into one growing
Message rather than a Message per chunk, that the user's words are drawn once
whether the turn is written down or refused, that a body chopped mid-object
still yields whole events, and that `/dashboard/job-applications/<id>` is the
one address that is not the general Conversation. What is left in the panel is
drawing.

Four things beyond the literal checklist:

- **The read answers `{ messages, cvAttached }` rather than `Message[]`.** The
  panel has to say plainly that no CV is attached _as it opens_, and whether
  one is is a fact about what this Conversation can see. Asking `/api/profile`
  instead would mint a signed URL to answer a boolean. `cvAttached` is
  `getProfile(...) !== null` — the same test `assembly.ts` applies before it
  decides what the model is told, so what the panel claims and what the model
  got cannot drift. This makes ticket 05's "returns the Messages oldest-first"
  line stale; a note is appended there.
- **`GENERAL_SCOPE` and `REPLY_BROKE_OFF_MESSAGE` moved into `contract.ts`.**
  The panel imports them into the browser, and they were sitting in `api.ts`
  and `stream.ts`, each one import away from a repository.
- **The panel is keyed on the scope.** A navigation that changes which
  Conversation the user is standing in remounts it, so nothing is left over —
  React's own answer to "reset when that changes", and it costs no effect
  unpicking one Conversation's state to make room for the next.
- **A failed clear is not a refused turn.** `clear` hands its problems back
  rather than pushing them into `said.refusal`, because a delete that did not
  happen under the heading "Nothing was said." tells the user the wrong thing.

The three failures the checklist asks to read differently are told apart by
where they happen, which is the rule ticket 05 states from the server's side. A
spent allowance and an unreachable provider are refusals before a byte of the
reply exists, and each arrives as the endpoint's own sentence under "Nothing
was said." — the panel paraphrases neither. A reply that broke off is an
ending on a stream that had already begun: it arrives as a Message marked
`incomplete`, and the failure is drawn against that text. The panel reads it
off `incomplete` rather than off the event, so a reply that broke off says the
same thing tomorrow as it did at the time. A stream that stops without any
ending at all is the same thing seen from the browser, and is answered by
re-reading the Conversation rather than by keeping the panel's own half of the
paragraph beside the stored one.

Nothing anywhere names the daily Model Call limit. The endpoint's own ceiling
sentence does not name one either, which is what makes relaying it verbatim
safe (ADR-0009).

Reviewed on both axes. What was found and fixed: the drawer had been hung below
the bar at `top-[60px]`, but `Page` is an ordinary scrolling document and the
bar does not stick, so a scrolled page showed a strip above the drawer — it is
`inset-y-0` again; the loading state had no skeleton beside its written line,
which `docs/design-system.md` asks for; the refusal block was a second
hand-built copy of `Failure`'s treatment, now one `FailureBanner` in
`states.tsx` that both use; the streamed reply and a stored one were two
renderings of the same thing, now one `Reply`; `scopeAt(path).scope` read
badly and is `standingAt`, which is `CONTEXT.md`'s own word for how a
Conversation is found; a Message bubble was off the type ramp at 13px; and two
comments used "chat", which `CONTEXT.md` proscribes.

Three findings were left alone, deliberately:

- **ADR-0009 says a spent allowance "shows the meter".** There is no meter yet —
  it is ticket 07, and drawn on the Profile. The refusal says the month is done
  and when it comes back, which is what the user can act on today; 07 should
  add the meter or a way to it here when it builds one.
- **The `broke-off` event's `error` is not rendered.** `stream.ts` sends
  `REPLY_BROKE_OFF_MESSAGE` as that field, so there is nothing in it the
  `incomplete` flag does not already say, and reading one sentence from two
  places is how the panel and a reload come to disagree.
- **28px controls inside a full-width drawer on a phone** are under the 44px
  the design system asks of a phone hit target. They are the app's existing
  `SECONDARY_BUTTON_SMALL` and `DANGER_BUTTON`, used at that size everywhere
  else; raising them is a change to every page and belongs to whoever makes it.

Verified in the real app rather than only in tests: signed in through
Playwright, opened the panel on the board, streamed a real reply from the
provider and copied it; confirmed the board's Conversation and a Job
Application's are two different Conversations chosen by address alone, that the
drawer sits flush on a scrolled page, that it is full-width on a narrow
viewport, and that what was said survives closing the panel, navigating away
and coming back.
