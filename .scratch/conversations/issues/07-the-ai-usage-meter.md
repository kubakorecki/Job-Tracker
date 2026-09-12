# 07: The AI Usage meter on the Profile

**What to build:** The one place the user sees what they have spent.

**Blocked by:** 02

**Status:** ready-for-agent

- [x] A meter on `/settings/profile` showing this month's AI Usage against the monthly limit
- [x] Reads in tokens, and says in words what a token is spent on — reading a Posting, reading a CV, an Analysis, a Conversation — so the number is legible to someone who has never thought about tokens
- [x] States when the month resets
- [x] Readable without relying on colour alone, as the fit ring already is
- [x] Says plainly when the allowance is spent, and that the month rather than a fault is the reason
- [x] Nothing anywhere shows, names or implies the daily Model Call count (ADR-0009)
- [x] Follows `docs/design-system.md` for tokens, type and voice

## Comments

Implemented on `feat/chat`. The meter is the fit banner's shape, deliberately:
a figure in the display face, the sentence beside it carrying the whole
reading, and a bar under it as reinforcement that is `aria-hidden` — which is
how the fit ring already answers "not colour alone", and one pattern is better
than two.

- `apps/web/lib/ai-usage/reading.ts` is the arithmetic and the wording, pure
  and taking its month as an argument (`reading.test.ts`), as
  `lib/coverage/fit-banner.ts` is for the fit.
- `apps/web/lib/ai-usage/view.ts` reads the clock and the meter for the page,
  beside `lib/profile/view.ts` and for the same reason: the Profile page
  renders on the server, where an HTTP hop to this app's own API buys nothing.
- `apps/web/app/settings/profile/ai-usage-meter.tsx` draws it, last on the
  page — the CV is what the user came for, and this is the record of what it
  has spent.

Three decisions worth recording:

- **The figure is a share, the sentence is in tokens.** A share is what the
  user came to read and seven digits in the display face are not legible to
  anyone; the sentence says the token figures exactly, which is what the
  checklist's "reads in tokens" is for.
- **The share rounds up, stops at 99% while the month has room, and is left
  unclamped above a hundred.** Up, so that any spending at all reads as some
  rather than as a month not yet begun. Stopped at 99, so the panel cannot
  read 100% beside a Conversation that would still answer — nought and a
  hundred are the two boundaries this figure exists to tell apart, and
  rounding up over one of them would be the page contradicting
  `mayStartAiCall`. Unclamped above, so the overshoot ADR-0009 allows shows as
  `104%` rather than being quietly hidden; only the bar stops at its own end,
  which is what `filled` is for.
- **`isSpent` is `aiUsageAt`, the comparison `mayStartAiCall` now makes.** It
  was inlined in `mayStartAiCall`; it is now a function both it and the
  reading go through, because a page saying the month has room while the next
  call refuses would be two limits wearing one name.

A spent month is worded apart from the other two states and says the month is
the reason rather than a fault, and the ember fill rather than rose says the
same thing again: rose is what this system says errors and destruction in, and
a month that ran out is an ordinary end.

Nothing names the daily Model Call count — nothing in `apps/web/app` or
`apps/extension` did before this either, which was checked rather than assumed.
The extension's one "today" string is the precaution wording ADR-0009 asks
for, and the remaining "daily" mentions are comments and identifiers, which
issue 02 deliberately kept.

## Comments — what the review changed

`/code-review` ran both axes over the finished work. Six of its findings were
right and are fixed here; the rest of this records them so the reasoning is not
lost.

**Wording.** `allowance` is on `CONTEXT.md`'s `_Avoid_` list for AI Usage, and
the first draft put it in four places of shipped copy — the first time the
avoided word would have reached a user, every existing one being a comment or
a test name. It is `AI Usage` and `a monthly limit` throughout now, and
`reading.test.ts` stands guard over all four avoided words rather than trusting
the next writer to remember.

**The 99% boundary.** The first draft rounded up unconditionally, so a month
with one token left read `100%` while `mayStartAiCall` still admitted a call —
the exact disagreement `aiUsageAt` was extracted to prevent, reintroduced one
field along.

**What a call costs.** The explainer said "a few thousand tokens each time",
while `MONTHLY_AI_USAGE_LIMIT`'s own sizing works out at about twenty thousand
a Conversation turn. A user budgeting on the smaller figure would have been out
by five times, which is the opposite of the legibility the checklist asks for.
It says "tens of thousands" now.

**ADR-0009 asks this refusal to show the meter**, and `AI_USAGE_SPENT_MESSAGE`
pointed nowhere. It now ends "your Profile shows the meter" — words rather than
a link, because four endpoints and the extension render that sentence as plain
text.

**The meter went stale on its own page.** Reading a CV spends from AI Usage,
the upload answer never says what it cost, and the panel is drawn on the
server — so `YourProfile` now refreshes the route after an upload, which is
what the tokens page already does. Its own state is untouched by the refresh,
which is why the Draft survives it.

**Housekeeping the review was right about**: `readAiUsage` lost a `month`
parameter nobody passed (`../profile/view`: "a default nobody reaches is a seam
that cannot be trusted"); the reading lost a `limit` field only its tests read;
the month formatter moved to `lib/day.ts`, which is where every date the app
shows is formatted; and the bar's clamp moved out of the component into
`filled`, so the feature has no arithmetic left in a place no test can reach.

One finding is addressed rather than accepted: `spectre` as the meter's fill is
undocumented in the design system. It is the right hue — spending is neither
good news nor bad, and the tally already uses spectre for a number that carries
no verdict — so `docs/design-system.md` gains an **AI Usage meter** entry
stating it, along with the ember-when-spent rule and the 99% boundary. The
printable version is regenerated by hand and was not.
