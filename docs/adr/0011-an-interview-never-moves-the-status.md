# An Interview never moves the Status

In practice the two go together: the user learns a date and moves the card to
`interviewing` in the same minute. It would be easy to make arranging an
Interview do it, or to drop the Status and derive `interviewing` from whether
any Interview exists. Both were rejected. Adding an Interview asks; the user
answers; the Status moves only because they said so.

The reason is what a Status is. `CONTEXT.md` has said since v1 that a Status is
where the user puts a Job Application and is never inferred, and it is the one
column in the product that is nobody's reading but theirs. The cases where the
two come apart are ordinary rather than exotic: a coffee with a recruiter is a
meeting and not a recruitment; a second interview may be booked on a Job
Application the user has already decided to withdraw from; a call booked and
then cancelled leaves a Job Application that never reached `interviewing`.
Deriving the Status would decide all three on the user's behalf, and once
derived there would be no way for them to disagree with it.

## Consequences

The prompt is part of the feature, not a nicety: without it the common path
costs two deliberate actions, and a user who skips the second has a Job
Application with an Interview on it sitting in `applied`. That state is legal
and nothing repairs it behind their back.

Silence is the opposite way round. A wait is not the user's opinion but what
happened to them, so Interviews feed it directly: a future Interview means
there is no silence to report, and once it is past the count runs from the day
of the meeting rather than from `updated_at` — the real "last heard from them"
that `silence.ts` was written waiting for.
