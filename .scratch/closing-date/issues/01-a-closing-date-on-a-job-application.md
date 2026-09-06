# 01: A Closing Date on a Job Application

**What to build:** The field itself — in the shared contract, in the database, and through every read and write of a Job Application.

**Status:** done

- [x] `closesOn` on the Job Application contract: a calendar day, nullable, defaulting to null on create
- [x] A `closes_on` date column, and a migration for it
- [x] The repository carries it in and out, like any other column
- [x] The detail view's edits round-trip it: an empty box is no Closing Date, a day is one
- [x] It is a day and not an instant — no time of day is invented for it

## Comments

`closesOn` sits in `jobApplicationFields` in the shared contract, so every
derived schema — create, patch, the stored shape, and the Draft — picked it up
from one line. It is `z.iso.date()`, not `z.iso.datetime()`: a Posting states a
day, and an instant would have needed a time of day and a zone we would have
had to invent (ADR-0007).

The column is `date("closes_on", { mode: "string" })`, read as a string rather
than a `Date` for the second half of the same reason — a `Date` is an instant,
and reading one back would put the day in the reader's zone. Migration
`0007_premium_shockwave.sql`, one nullable column, applied to the dev project.

The pleasant consequence is in `edits.ts`: `<input type="date">` and the
contract hold the identical `2026-09-30`, so the converter is `orNull` and
there is no date arithmetic anywhere on the form's path. `appliedAt` beside it
needs `appliedDateInput`/`appliedAtFromDateInput` precisely because it is an
instant.
