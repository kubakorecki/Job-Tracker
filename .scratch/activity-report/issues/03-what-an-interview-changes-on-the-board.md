# 03: What an Interview changes on the board

**What to build:** The readings that stop being guesses once meetings are recorded.

**Status:** done

- [x] `silenceOf` reads Interviews: a future one means no silence at all, and a past one is what the count runs from, in place of `updatedAt`
- [x] The comment in `silence.ts` about `updatedAt` being a stand-in goes, replaced by what now decides it
- [x] `threadOf` draws a beat for an Interview arranged and one for an Interview held, cancelled ones marked
- [x] The next Interview's date shows on the board card and the table row, beside where the Closing shows, per `docs/design-system.md`
- [x] A Conversation attached to a Job Application is assembled with its Interviews; the general Conversation gets the next Interview's date in the outline (ADR-0008)

## Comments

Built as `apps/web/lib/interviews/reading.ts` — `nextInterview`,
`lastInterviewHeld`, `inTheOrderHeld` and the two wordings — with the four
surfaces reading through it.

**Both readings live in one module rather than at each surface.** The tag on a
card, the count on the board and the thread on the page would otherwise come to
three views of one recruitment. Like `closingOf` and `silenceOf` beside them,
they are arithmetic and wording only, and `today` is an argument rather than a
call to the clock.

**A meeting held today counts as still to come, in both of them.** Nobody is
being ghosted on the morning of their interview, and the day itself is the one
day the card most needs to say so. It is one line drawn once, and the thread,
the tag, the prompt and the silence all sit on the same side of it.

**A meeting that was called off is passed over by both.** When it was called
off is nowhere in the record — nobody is asked for that date — so the only
honest thing to do with one is stop counting from it: it neither ends a silence
nor starts one. Counting from the day it would have been held would be counting
from a day on which nothing happened. It still draws its beat in the thread,
because arranging it was something the employer did.

**A meeting held outranks `updatedAt` rather than joining the comparison.** An
employer who saw the user three weeks ago has been heard from three weeks ago,
whether or not a note was typed on the record since. Where no meeting has been
held, `updatedAt` still stands in, and the paragraph about what that is and is
not stays — it is now about the case it still covers rather than about every
case.

**`threadOf` sorts.** A recruitment does not arrive in order: a second round is
often arranged before the first is held, and either may have been typed in at
any time. Everything is placed by a calendar day, because a Job Application's
stamps are instants and an Interview's two dates are days, and `YYYY-MM-DD`
strings are the one comparison both can be put through. The sort is stable, so
an invitation stays before the meeting it arranged where the two fall on one
day.

**The rail ends on a meeting only where the user is waiting.** Found while
reviewing: a Job Application that has been answered — an Offer, a Rejection, a
Withdrawal — with a meeting nobody got round to calling off was ending its rail
on `Interview 10 Sept` instead of on `They said no`. `silenceOf` had the rule
right already ("a Job Application that has been rejected is answered whatever
is in the diary") and `threadOf` did not. The list of the four Statuses is now
one exported predicate, `waitingOnSomebody`, which both read — two copies would
be two things to change when one moves. The invitation still draws its beat on
an answered Job Application, because the employer did arrange it; it is only
the last beat, which says where it stands today, that the answer keeps. Three
tests in `thread.test.ts`.

**The tag on a card is deliberately not gated the same way.** A meeting in the
diary on a Job Application that has been rejected still shows, because it is
true and the Status pill is beside it saying so — the tag adds a fact where the
rail was replacing one. Worth revisiting if it reads as the board asking the
user to keep a day free for a meeting that is not happening.

**The tag takes the page's own line and ink, not an accent.** It asks nothing
of the user, and the two accents a tag can take here are for a clock running
out and a wait going cold. Colour would also be the one thing it could not
carry honestly: `ember` is the Interviewing Status's, and the Status pill is
the only thing in the system that carries a Status's colour.

**It never appears beside a silence tag, by construction rather than by
arrangement** — `silenceOf` reports nothing at all while a meeting stands. That
is what lets it share the table's Silence cell instead of taking a column: every
heading in that table sorts, and a column would be inventing an order nobody
asked to read their pipeline in.

**One line between a meeting to come and a meeting held.** Found in review:
`heldOn >= today` was written out three times — in `nextInterview`, in the
thread's beats, and in the tense a Conversation is told to write in — each with
a docstring saying it had to agree with the other two. It is now `stillToCome`
in `reading.ts`, and the agreement is by construction rather than by comment.

**Two documents caught up.** ADR-0008's inventory of what a prompt is sent
listed the attached Job Application's fields and the general outline's five,
and this change added to both — so the ADR now names the Interviews and the
next Interview's day, with a paragraph on why the meetings need no fence and
why the invitation's link is left out. `docs/design-system.md` gained the Next
Interview tag, the Interviews panel, and the note that a called-off meeting
borrows the Ghosted silence treatment — the one place a tag treatment is shared
across two axes, shared because both are absences.

**The attached Conversation is given the meetings unfenced.** They are the
user's own records — the stage is their word for it and the notes are theirs
about the employer — so they need no fence, exactly as the Job Application's own
notes need none. The fence is for text scraped from a stranger's website
(ADR-0008). The link out of an invitation is deliberately left out: the model
cannot open it, and it is the one piece of an Interview that did come from the
employer. That an online meeting is online is the part that matters to an
answer, and that is what is said.

**The general Conversation gets the next meeting's day and no more of the
recruitment than that.** An outline line is about thirty tokens, which is what
makes two hundred of them affordable, and a day in the diary is the one thing
about a Job Application that "which of these should I chase this week?" turns
on.

**Three readings the ticket did not list came along for free.** The board's
tally, the silence sort and the silence filter all take a whole Job Application
and count through `silenceOf`, so a Job Application with a meeting in the diary
now drops out of the quiet count, sorts with the blanks, and is no longer
matched by a silence filter. That is the same rule reaching every surface at
once, which is the reason the reading lives in `silenceOf` rather than at each
of them.
