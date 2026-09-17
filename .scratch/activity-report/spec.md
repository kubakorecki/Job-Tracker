# Activity Report

Status: ready-for-agent

## Problem Statement

Once a month the user has to hand the labour office an account of their job
search: which employers they contacted, what they did, and what came back.
The tracker holds almost all of it and can answer none of it.

- **When did it happen?** A Job Application carries only where it stands today.
  A rejection that arrived on 5 September is indistinguishable from one that
  arrived in June, so nothing can say what belongs in September's report.
- **What happened in between?** A recruitment is several meetings, and the
  tracker has one Status for the lot. The day an interview was arranged, the
  day it was held, and which stage it was are nowhere.
- **Where does the document come from?** Today the user reads the board and
  retypes it into a form. Everything they are copying is already in the
  database.

## Solution

Three things, shipped together, because the report is made of the first two.

### Status Change

Every move of a Status is recorded: which Status, and when. Saving a Job
Application straight into a Status counts — an extension save that lands in
`applied` is how it came to stand there. Nothing is written for the months
before this ships, and nothing is ever edited afterwards (ADR-0010).

### Interview

A Job Application holds a list of Interviews: the day it is held, an optional
time, the user's own word for the stage, an optional link for an online
meeting, where it is, whatever they noted, and the day it was arranged — which
is a separate fact, because the invitation and the meeting often fall in
different months. A rescheduled Interview is edited in place; a cancelled one
stays, marked, because the employer still did something. Arranging one asks
whether to move the Status and never moves it alone (ADR-0011).

Interviews change two readings the product already makes:

- **Silence.** While a future Interview stands there is no silence at all, and
  once it is past the count runs from the day of the meeting. This is the real
  "last heard from them" `silence.ts` was written waiting for.
- **The thread.** Arranged and held are beats, in among the ones the detail
  view already draws.

The next Interview's date shows on the board card and the table row, where the
Closing already does.

### The report itself

A month's Activity Report is proposed from the data and finished by hand. It is
never stored: it is generated for the month, edited, printed, and remembered
only by the office.

- **Which Job Applications.** Every one something happened on that month: a
  Status Change, an `applied_at`, an Interview arranged or held. A Job
  Application still only bookmarked appears nowhere.
- **One row each**, in the order of the month's first event, with manually
  added rows last.
- **Column 1** — company, job title, location, `Źródło: {source}`, and the
  Posting's link, shortened for print and still clickable.
- **Column 2, what the user did** — `Złożenie CV` from `applied_at`;
  `Rozmowa kwalifikacyjna — {stage}` for each Interview held that month;
  `Wycofanie kandydatury` from a Status Change to `withdrawn`.
- **Column 3, what came back** — `Zaproszenie na rozmowę` on the day an
  Interview was arranged; `Oferta pracy` and `Odmowa` from their Status
  Changes; `Brak odpowiedzi` where the month brought nothing back.
- **Editing.** Every cell, plus adding and deleting rows, plus a free
  `Uwagi` block under the table that prints only when it has something in it.
- **Language.** Polish or English, chosen before generating. Headings, the
  generator's own wording and date formats translate; anything the user typed
  does not. Switching regenerates, after confirming.
- **The month** defaults to the previous one, and month boundaries are the
  browser's zone.
- **Three contacts** is the monthly minimum. Under it the view warns; it never
  blocks printing, and manually added rows count.
- **The PDF** is the browser's own: an A4 print stylesheet and Save as PDF.
- **Remembered in the browser** (`localStorage`, nothing server-side): the
  user's name, the last language, and the unsent draft per month and language.
  "Generate again" discards the draft.

## Non-goals

- **No stored report.** Nothing about a printed report is persisted. What was
  sent is the office's copy.
- **No backfilled history.** The months before this ships have no Status
  Changes, and their reports are typed by hand (ADR-0010).
- **No inferred Status.** Adding an Interview asks (ADR-0011).
- **No company address or telephone**, which the tracker has never held and
  which no Posting reliably states. The user types them into a cell if an
  office insists.
- **No `notes` in the report.** Notes are written for the user, about the
  employer, and are nobody else's business.
- **No calendar and no reminders.** The next Interview's date on a card is as
  far as this goes; there is no scheduler in this product.
- **No upcoming-interviews view.**
