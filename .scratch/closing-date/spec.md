# Closing Date

Status: ready-for-agent

## Problem Statement

A Posting stops accepting applications on a day, and the tracker does not
record it. That one missing fact leaves three questions unanswerable:

- **How long have I got?** A bookmark is a job the user meant to apply for and
  has not. Nothing on the board says which of them is about to become
  impossible, so the bookmark that needed acting on this week looks exactly
  like the one that closes in two months.
- **Did I miss it?** A bookmark whose Posting has closed is dead weight in the
  pipeline, and reads today as an ordinary bookmark waiting to be actioned.
- **Am I still waiting for anything?** Once the user has applied, the day the
  Posting closed is the day the employer stopped collecting candidates. Before
  it, silence means nothing at all — the shortlist is not drawn. After it,
  silence starts to mean something, and how long it has gone on is what tells
  the user whether to keep waiting or move the Job Application to `rejected`.

All three are the same date, read from three places the user stands.

## Solution

Record one field on a Job Application: a **Closing Date**, the day the Posting
stops accepting applications, as the Posting states it.

Derive from it a **Closing** — what that date amounts to today, given where
the Job Application sits in the pipeline. Four readings:

| Reading         | When                                             | What it tells the user       |
| --------------- | ------------------------------------------------ | ---------------------------- |
| `open`          | still to come                                    | there is time                |
| `closing-soon`  | within a week, and still only bookmarked         | act now, or lose it          |
| `missed`        | passed, and still only bookmarked                | this one got away            |
| `closed`        | passed, and the user has applied or moved past it | intake is over; how long the silence has run |

Only a bookmark can be urgent: a deadline on a job the user has already applied
for asks nothing of them, and a ring of red around it would be an alarm with no
action behind it. Whether it has passed is arithmetic; whether that matters is
the Status.

The Closing shows wherever a Job Application is shown without being opened —
every board card and every table row — and on the detail view beside the
Status. The date itself is editable on the detail view, settable when a Job
Application is added by hand, and read from the Posting by extraction so that
a job saved from the side panel arrives carrying its own deadline.

## Non-goals

- **No notifications and no digest.** The tracker has no scheduler and no way
  to reach the user when they are not looking at it. The indicator is on the
  board, which is where the user goes to decide what to do next.
- **No automatic Status change.** A Posting closing does not reject anybody,
  and a tracker that moved a Job Application to `rejected` on a date would be
  inventing an outcome the employer never stated. The user decides; this
  feature gives them the elapsed time to decide on.
- **No relative dates read off a page.** "Closes in 5 days" on a Posting is a
  fact about when the page was rendered, not about the role. Extraction records
  a stated calendar date or nothing.
