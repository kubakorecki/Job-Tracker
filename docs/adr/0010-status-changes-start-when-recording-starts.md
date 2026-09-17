# Status Changes start when recording starts, and `applied_at` stays the day the CV went

A Job Application has always carried only where it stands today. The Activity
Report needs when it got there — an employer's answer belongs to the month it
arrived in, not to the month the user reads the board. So every move of a
Status is now recorded as a Status Change: which Status, and when.

**Nothing is written backwards.** The history begins on the day recording
begins. A Job Application that has sat in `rejected` since July gets no row
saying it was rejected in July, because nobody knows that — `updated_at` is the
day someone fixed a typo, and a Status Change invented from it would be a
record of something that did not happen on a day it did not happen. The
alternative was a migration that seeded one row per existing Job Application
from `applied_at`. It was rejected for the same reason ADR-0006 refuses to
annualise a salary and ADR-0007 refuses to resolve "closes in 5 days": once
stored, an invention cannot be told from a fact. The cost is real and bounded —
the months before this shipped have no history, and the user fills those
reports in by hand.

**`applied_at` remains the only source for "the CV went out".** Moving a Job
Application to `applied` now writes both `applied_at` and a Status Change, and
the two can disagree: the user corrects `applied_at` to the Tuesday they
actually sent it, while the Status Change keeps the Thursday they got round to
moving the card. The date the user corrected is the true one, so the Activity
Report reads `applied` from `applied_at` and ignores the Status Change on it.
Every other Status is read from the Status Changes, which are the only record
of when those happened.

## Consequences

A Status Change is never edited. It says what happened at a moment, so a
mistaken move and the move back are both in the history, and the user edits the
Activity Report — which is a document, not a record — rather than the history
behind it.

Deleting a Job Application takes its Status Changes with it, and with them any
past month's report that would have been regenerated from them. The Activity
Report is not stored, so a deleted Job Application leaves an August report that
no longer regenerates the way it printed. Withdrawing rather than deleting is
what keeps the history.
