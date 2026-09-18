# The Activity Report is made in the browser, in the reader's own month

Everything else this app dates is dated in UTC. `lib/day.ts` says why: a record
is rendered on the server and again in the browser, and a date that changed
with the machine would be a different date in each — a card would say one day
in the server's HTML and another after hydration, and the board would count a
different number of quiet days in each.

An Activity Report cannot be dated that way. It is an account of one month
handed to a labour office, and the month it is about is the user's month: a
rejection that arrived at half past midnight on 1 October in Warsaw belongs to
October's report, though UTC calls it the evening of 30 September. Dating it in
UTC would put a fortnight's worth of late evenings a year in the wrong month,
and the user cannot correct it, because the month is not a field on the
document.

So the report is proposed in the browser, from data the page was handed, with
the month's boundaries in the browser's own zone. There is no second render to
disagree with, which is precisely what makes leaving UTC safe here and nowhere
else: the server renders the page with no report on it and says it is loading,
and the browser draws the document as it hydrates.

Generating on the server and sending the zone up with the request was the
alternative. It buys nothing — the page would still have to wait for the
browser to say where it is — and it costs a round trip per month the user looks
at, on a document they read in a dozen versions while filling it in.

## Consequences

**The page is handed everything and chooses a month from it.** It reads every
Job Application and the Status Changes of the last fourteen months, and the
month selector moves through them without touching the server. That is one
generous read rather than one read per month looked at; the window is cut two
months wider than the selector can reach, because the server does not know the
reader's zone and a window cut to the month would lose a day off the far end
for a reader east of UTC.

**The draft is in the browser too, and so it has to be.** A document assembled
where the user is standing cannot be half-kept somewhere else, and an Activity
Report is never stored in any case — what was sent is the office's copy
(`CONTEXT.md`). The unfinished sheet lives in `localStorage`, one per month and
language, and dies with the browser profile. A user who fills in half a report
on their laptop finds nothing waiting on their phone, which is the same
arrangement as the dashboard's remembered view and period, and is the price of
not storing a document about somebody's unemployment on a server.

**Two clocks sit side by side in `lib/day.ts`.** `todayInUtc` is the one
everything else reads; `todayInZone` and `dayInZone` are the report's, and they
are the only calls in the app that take a zone. Anything new that dates a
record uses the first. The second is for a document about a month, and the test
of whether a reading belongs to it is whether the answer would embarrass the
user in front of somebody else.
