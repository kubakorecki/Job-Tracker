# Dashboard Sorting and the Salary Equivalent

Status: ready-for-agent

## Problem Statement

The dashboard shows Job Applications in one order only: newest added first,
in the table and in every board column. Two questions it cannot answer:

- **Which ones matter most by some measure I care about?** Fifty rows in the
  table cannot be put in order of fit, excitement, closing date or anything
  else, so finding the best-paid, the best-fitting or the one closing next
  means reading every row.
- **What does this job pay, next to that one?** Salaries are recorded as the
  Posting states them (ADR-0006) — `17 000–26 090 PLN / month` beside
  `150 PLN / hour` beside `£55 000 / year` — and the dashboard does not show a
  salary at all. Even if it did, the figures cannot be set side by side by eye.

## Solution

**A Salary Equivalent** (see `CONTEXT.md`): each recorded salary restated over
the Salary Period the user chooses to read salaries in. Worked out wherever it
is shown and never stored, on one fixed working year — 12 months, 260 days,
2080 hours. It restates the period only, never the currency.

- A **period picker** — year / month / day / hour — in the dashboard toolbar,
  beside the view toggle. Starts on **month**. Remembered in browser storage,
  as the view toggle is.
- **Table:** a new **Salary** column after Location.
- **Board card:** the same short form on one line.
- The detail view and the side panel go on showing and editing the salary as
  stated. Conversations go on receiving the stated salary.

**Sorting**, one choice shared by both views and remembered in browser
storage:

- **Table:** an arrow control on every column heading. The first click sorts in
  the column's natural direction, the second reverses, the third clears back
  to newest added.
- **Board:** a "Sort: …" dropdown in the toolbar, ordering the cards within
  each Status column. It offers every sort except Status.
- Sorting applies to what the filters admit, after they have admitted it.

### The short form of a salary

| Case | Reads |
| --- | --- |
| Range, period changed | `≈ 17–26.1k PLN / mo` |
| Range, period as stated | `17–26.1k PLN / mo` |
| Lower bound only | `≈ from 17k PLN / mo` |
| Upper bound only | `≈ up to 26.1k PLN / mo` |
| Small figures | `≈ 95–120 PLN / h` |
| No currency | `≈ 17–26k / mo` |
| No salary | `—` (the dash Location uses) |

- Each bound is formatted on its own: at or above 10 000 in thousands with at
  most one decimal and a `k`; below that, a whole number.
- Period suffixes: `yr`, `mo`, `day`, `h`.
- `≈` appears only when the arithmetic changed the figure — the stated period
  differs from the chosen one.
- Hovering the `≈` names the Posting's own figure and the rule, e.g.
  `Stated as 150–180 PLN / hour · a year of 12 months, 260 days, 2080 hours`.

### Sort orders

| Column | Natural direction (first click) |
| --- | --- |
| Company, Job title, Location | A→Z, case-insensitive, locale-aware |
| Salary | highest first (see below) |
| Fit | highest Fit Fraction first |
| Status | pipeline order: bookmarked → withdrawn |
| Silence | most days first |
| Closes | earliest date first — past dates rise to the top, whatever the Status |
| Excitement | highest first |

- **Blanks last, in both directions**: no salary, no Fit Fraction, no silence,
  no Closing Date, no Location. An unknown is not a low value.
- **Ties** keep newest added, so a sort only moves what it has a reason to move.
- **Salary** ranks within currency groups. The group order is: the currency the
  user's Job Applications are most often quoted in, then the other currencies
  from most to least common (alphabetical on a tie), then salaries with no
  currency. Within a group, by the middle of the range in Salary Equivalent,
  or by the one bound there is. The currency count is taken over every Job
  Application, not only the ones the filters admit, so narrowing the view does
  not reshuffle the groups.
- **Closes** is a plain date order on purpose. A bookmark whose Posting has
  closed rises to the top, which is the nudge to withdraw it. Applied-for Job
  Applications with a past Closing Date rise too; that was accepted, and the
  filters are how the user narrows it. If it grates, only `missed` Closings
  should rise (see Non-goals).

## Non-goals

- **No currency conversion.** An exchange rate is the same kind of silent guess
  ADR-0006 refuses to store. Currencies are ranked apart.
- **No editable working year.** The factors are fixed and visible on hover.
- **No preferred-currency control.** It is read off the user's own Job
  Applications.
- **No Status-aware Closes sort.** Revisit if applied-for Job Applications with
  a passed Closing Date crowd the top.
- **No manual ordering of cards** within a board column. Dragging still only
  changes Status.
- **No server-side sorting and no URL state.** The dashboard already narrows
  its one cached list in the browser (`filtering.ts`); ordering it is the same
  kind of arithmetic.
- **No change to the stored salary, the detail view, the side panel or
  Conversations.**

## Already done during design

- `CONTEXT.md`: **Salary Equivalent** added after Salary Period.
- `docs/adr/0006-…`: the Consequences paragraph that said nothing ranks
  salaries now records how ranking is done.

## Issues

1. `01-the-salary-equivalent.md` — the arithmetic and its wording, pure
2. `02-salary-on-the-dashboard.md` — period picker, table column, card line
3. `03-the-order-of-the-dashboard.md` — the sort orders, pure
4. `04-sorting-the-table.md` — arrows on the headings
5. `05-sorting-the-board.md` — the toolbar dropdown
