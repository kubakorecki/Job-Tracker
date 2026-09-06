# 03: The Closing where the user looks

**What to build:** The visual indicator — on every board card, every table row, and the detail view.

**Blocked by:** 02

**Status:** done

- [x] One component for all three surfaces, so they cannot come to different views of the same date
- [x] The words carry the meaning; colour only reinforces it — a deadline that is about to pass must be readable without telling amber from grey
- [x] `closing-soon` and `missed` are the only two that raise their voice
- [x] The full sentence is available on hover and to a screen reader
- [x] A "Closes" column on the table, and a dash where no date is recorded
- [x] The detail view shows it beside the Status and offers a date box to correct it
- [x] A Job Application with no Closing Date shows nothing at all — no empty pill, no placeholder on a card

## Comments

`app/dashboard/closing-badge.tsx`, one component for all three surfaces, next
to `fit-ring.tsx` and following the same shape: handed the raw fields, works
the reading out itself, and returns `null` where there is nothing to say.

The pill is outlined rather than filled, deliberately: it sits beside the
filled `StatusBadge` on both the card and the detail header, and two filled
pills would read as two of the same kind of thing. Only `closing-soon` (amber)
and `missed` (red) raise their voice; `open` and `closed` are the page's own
grey, because a deadline the user has already acted on is a fact rather than a
warning. `closingLabel` says the whole of it in words, so nothing is legible
only to a reader who can tell amber from grey.

On the card the badge shares the fit ring's line, which keeps a card that has
both from growing a third row; the line is still `empty:hidden`, and is empty
exactly when both components drew nothing. The table's Closes cell shows a dash
where no date is recorded — unlike the Fit cell, which stays blank, because an
unrecorded date is a blank the user could fill in where an unknown fit is not a
verdict.

The detail header reads `saved` rather than the edit boxes, so an unsaved date
cannot make the badge claim something the record does not yet say.

**After review.** The table was asking `closesOn === null` for itself to decide
whether to draw a dash, which is the second copy of a question `ClosingBadge`
already answers — the exact duplication the card's own comment says it exists
to avoid. The badge now takes an `unrecorded` node, `null` by default, and the
table passes the dash. Whether a Job Application has a Closing Date at all is
one component's answer again.

The prose across the whole change also used "deadline", which `CONTEXT.md`
lists under the Closing Date entry's `_Avoid_` — including inside the
model-facing extraction prompt. `docs/agents/domain.md` is explicit that output
naming a domain concept uses the glossary's word, so the word is gone from the
code, the tests, the ADR and the prompt; the only occurrence left in the repo
is the `_Avoid_` line forbidding it.
