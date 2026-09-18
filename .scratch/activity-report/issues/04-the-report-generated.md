# 04: The report, generated

**What to build:** The pure function from a month to a proposed report, and nothing about the page.

**Status:** done

- [x] A month selector defaulting to the previous month; boundaries in the browser's zone
- [x] Rows: every Job Application with a Status Change, an `applied_at`, or an Interview arranged or held in the month. Never a bookmark
- [x] Column 2 from `applied_at`, Interviews held, and a Status Change to `withdrawn`; `applied` is read from `applied_at` and its Status Change ignored (ADR-0010)
- [x] Column 3 from the day Interviews were arranged and from Status Changes to `offer` and `rejected`; `Brak odpowiedzi` where the month brought nothing back
- [x] Column 1 from company, job title, location, `source` and the Posting's link
- [x] Rows in the order of the month's first event
- [x] Today as an argument, never a call to the clock, so every case is testable

## Comments

Built as `apps/web/lib/activity-report/` — `month.ts` for the calendar,
`report.ts` for the generator, `wording.ts` for everything the document says in
its own voice, and `link.ts` for the Posting's address. All of it is arithmetic
and wording, like `closingOf` and `silenceOf` beside it: the month, the zone,
the language and the data are arguments, and nothing in the module reads a
clock or a store.

**A row exists where there is something to print, not wherever a Status Change
falls.** The ticket said "every Job Application with a Status Change", and it
is implemented one step tighter than that: three Statuses are silent, and a Job
Application whose month holds only one of them gets no row.

- `bookmarked` is not a contact with anybody. Saving a Job Application records
  a Status Change like any other move, so every bookmark saved this month has
  one — and a report made from them would list jobs the user merely looked at
  as jobs they applied for. This is the ticket's own "never a bookmark",
  reached by ignoring the Status rather than by reading where the Job
  Application stands today.
- `applied` is read from `applied_at` instead, which is ADR-0010's rule. The
  consequence worth naming: a CV the user recorded as having gone out in August
  and only moved the card for in September appears in **August's** report and in
  no other, which is where it belongs.
- `interviewing` is the answer to an invitation the Interview already records
  (ADR-0011). Printing it as well would report one invitation twice on the
  ordinary path, where the user recorded the meeting and said yes to the prompt
  offering to move the Status.

The case this gives up is a user who moved a Job Application to Interviewing and
recorded no meeting: they get no row, and add one by hand. That is what added
rows are for, and it is the better failure — a row saying `Brak odpowiedzi`
against a month in which somebody plainly did answer would be a worse lie than
an omission the user can see is missing.

**The month is the user's own month, and this is the one place the app leaves
UTC.** `dayInZone` and `todayInZone` in `lib/day.ts` sit under a paragraph
explaining why: everything else is dated in a fixed zone because a record is
rendered on the server and again in the browser, and a date that changed with
the machine would be a different date in each. The report is rendered in the
browser only — there is no second render to disagree with — and a rejection
that arrived at half past midnight on 1 October in Warsaw belongs to October's
report, though UTC calls it the evening of 30 September. There is a test for
exactly that instant.

**The cells carry their dates, which the ticket did not say and the form
needs.** A labour office reads a contact report date-first, so each entry is
`{day}: {wording}` — `5 września: Złożenie CV`, `12 września: Rozmowa
kwalifikacyjna — screening`. The day is the day and the month name, without the
year, because the year is in the header and every entry belongs to the one
month the header names. `Brak odpowiedzi` is the one entry with no date, being
the absence of one.

**Column 1 is text, and the link is its own field beside it.** A URL inside a
block of editable text is either two hundred characters of tracking parameters
or not a link at all; carried separately it can be shortened on the sheet and
still be a real `href` in the PDF, which is 06's requirement. It is editable
like every other cell.

**A meeting that was called off still counts as an invitation.** Arranging it
was something the employer did, and the month it was arranged in is a month
that answered. Only the holding drops out, because it never happened — the same
line `reading.ts` draws for the silence and the thread, drawn here for the two
columns.

**The order is the month's first event, stably.** Two Job Applications whose
months opened on the same day keep the order the page read them in, which is
the board's own. There is nothing better to break that tie on, and a sort that
invented one would be an order nobody asked to read their month in.

**Both languages are generated, and the user's words are never translated.**
`wording.ts` holds every phrase the generator can produce, in Polish and
English, plus the two date formats; the stage on an Interview and anything typed
into a cell cross a language change untouched. The Polish is canonical, because
the phrases are the ones the office's own forms use, and it is what a user with
no remembered choice starts in.

Twenty-two cases in `report.test.ts`, plus `month.test.ts`, `wording.test.ts`
and `link.test.ts`. The read behind it is `statusChangesSince` in
`lib/status-changes/repository.ts`, with the `(user_id, changed_at)` index the
schema comment had been holding the place for — migration `0014`, applied to
dev, still to be applied to production by hand.

**From review.** `shortLink` could overflow the cell it was shortening for: a
host longer than the budget left `ROOM_IN_A_CELL - host.length - 1` at or below
nought, and slicing that many characters off the end returned nothing at all —
so `careers.some-very-long-department.example.com/openings/42` printed as the
bare host and an ellipsis, with none of the address that says which job. It now
cuts where the room ends instead, and there is a case for it.
