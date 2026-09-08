# A Closing Date is a day, and it is read against the Status

A Job Application carries one Closing Date — the day the Posting stops
accepting applications — and everything the interface says about closing is
derived from it. It is stored as a calendar day rather than an instant, and
what it means is decided against the Job Application's Status rather than by
the date alone.

**A day, not an instant.** `applied_at` beside it is a timestamp, and copying
that would have meant choosing a time of day and a zone for a fact that has
neither: a Posting says "applications close on 30 September", and midnight in
some zone is our invention. Once stored, the invention is indistinguishable
from what the page said — the same failure ADR-0006 records about annualising a
salary. So the column is a `date`, the contract states `z.iso.date()`, and it
is read out of the database as a string: a `Date` is an instant, and reading
one back would put the day in the reader's zone, where it would move for anyone
west of UTC. The pleasant consequence is that `<input type="date">` and the
contract hold the identical string, so the form needs no conversion in either
direction.

**Read against the Status.** The same date means three different things
depending on where the user is standing, and the tracker already knows which:

- On a `bookmarked` Job Application it is a date to act before. Within a week
  it is the one thing on the board asking to be acted on.
- On a `bookmarked` Job Application, once passed, it is a bookmark that got
  away.
- On anything further down the pipeline, a passed Closing Date is the day the
  employer stopped collecting candidates. Before it, silence means nothing —
  the shortlist is not drawn. After it, how long the silence has run is what
  tells the user whether to keep waiting or to move the Job Application to
  `rejected`.

So `closingOf` takes the Status as well as the date, and only a `bookmarked`
Job Application can read as `closing-soon` or `missed`. The alternative was to
colour a near Closing Date loudly wherever it appeared. It was rejected because
an alarm on a job already applied for asks nothing of the user, and an alarm
with no action behind it is how a user learns to stop reading them.

## Consequences

The reading is a pure function of a date, a Status and today, and today is an
argument rather than a call to the clock — which is what makes every case
testable and what keeps the server's render and the browser's agreeing. Today
is a UTC day for the same reason `dayOf` formats in UTC.

Nothing acts on a Closing Date on its own. There is no scheduler in this
product and no way to reach a user who is not looking at it, so the Closing is
told on the board, where the user goes to decide what to do next, and nowhere
else. A Job Application is never moved to `rejected` automatically either: a
Posting closing does not reject anybody, and a tracker that inferred an outcome
from a date would be recording something no employer ever said. The elapsed
count is given so the user can make that call; making it is theirs.

Extraction records only a date the Posting states. A page that says "closes in
5 days" is stating a fact about when it was rendered, not about the role, and
resolving it against the day of the extraction would store a Closing Date the
page never printed — the same objection as the salary multiplier. `readDraft` drops
anything that does not parse as a calendar day rather than passing it on, so a
model that answers with a countdown costs the Draft its Closing Date and
nothing else.

**The year is the reader's, and now the extraction's.** A page states a Closing
Date the way a person reads one, and pracuj.pl states it as "ważna jeszcze 16
dni (do 24 wrz)" — a day and a month, with the year left to whoever is looking.
That is a stated date with a piece missing, not a countdown, so extraction
completes it: the reading is given today as a UTC calendar day, and the year is
whichever one puts that day on or after today. Completing it is not the
inference this ADR rejected. A countdown says nothing about the role at all,
whereas "24 wrz" names the day the Posting closes and leaves out only the part
no reader could get wrong.

The day is the endpoint's, read from the clock there and passed down — a
client's clock could be anything, and a browser two years slow would move every
Closing Date read through it. Before it was passed down at all, a model with no
notion of today reached for the year its training left it with: a Posting
closing on the 24th of September 2026 was recorded as closing in 2024, in a date
box where nothing looked wrong.

So `readDraft` also drops a day further than a year either side of today. A
Posting closing a year out does not exist and one that closed a year ago is
past recording, which leaves the window wide enough for the archived Posting
read months late and narrow enough to catch a year the model supplied itself.
A dropped Closing Date is a field the user fills in; a wrong one is a deadline
they act on.
