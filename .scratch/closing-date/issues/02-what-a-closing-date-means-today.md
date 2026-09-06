# 02: What a Closing Date means today

**What to build:** The Closing — one pure reading that turns a Closing Date and a Status into what the user should do about it, with the words to say it in.

**Blocked by:** 01

**Status:** done

- [x] Four readings: `open`, `closing-soon`, `missed`, `closed`
- [x] `closing-soon` is a deadline within a week that the user could still act on — only a `bookmarked` Job Application qualifies
- [x] `missed` is a passed deadline on a `bookmarked` Job Application; `closed` is a passed deadline on any other
- [x] The days are whole days, counted in UTC, so the same date reads the same on the server and in the browser
- [x] Today is an argument, not a call to the clock, so every reading is testable
- [x] A sentence for each reading, saying what it means rather than restating the date — including, once closed, how long the silence has run
- [x] No Closing Date means no Closing at all

## Comments

`lib/job-applications/closing.ts`, with `closing.test.ts` beside it — pure,
and tested at a fixed `TODAY` so no case passes in the morning and fails in the
evening of the day a deadline falls on.

Three decisions worth naming.

**The Status is an input, not something the caller applies afterwards.** Only a
`bookmarked` Job Application can read `closing-soon` or `missed`. A deadline
three days off on a job already applied for asks nothing of the user, and an
alarm with no action behind it is how a user learns to stop reading them. Doing
this in the component would have put the rule wherever a badge was drawn.

**The reading carries the day it is about.** `Closing` is `{ kind, days, on }`,
so `closingDescription` needs no second argument. The first draft passed the
date alongside; that is a sentence that can be assembled from the wrong pair,
and it also forced every caller into a redundant null guard to satisfy the
narrowing.

**The four variants are one shape, so it is one object with a `kind` rather
than a discriminated union.** All four carry the same fields; a union would
have been four identical payloads and a `Record<ClosingKind, string>` for the
tones would not have typed.

The days are never negative — which way the deadline lies is the kind's
business — and are counted between two UTC midnights, so no hour of daylight
saving makes a month come out a day short.
