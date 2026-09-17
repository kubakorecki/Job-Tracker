# 03: The order of the dashboard

**What to build:** The sort orders as a pure module in `apps/web/lib/dashboard/`
(beside `view.ts`), and the remembered sort choice. It orders a list the
filters have already narrowed, the way `matching` in `filtering.ts` narrows
one. Nothing in the interface yet. See the spec's "Sort orders".

**Blocked by:** 01

**Status:** done

- [x] A sort is a column and a direction, or none. None is newest added, the order the list already arrives in
- [x] The sortable columns: company, job title, location, salary, fit, status, silence, closes, excitement — each with its natural first direction from the spec
- [x] The click cycle as a pure function: none → natural → reversed → none, and clicking a different column starts that column at its natural direction
- [x] Blanks last in both directions: no salary, no Fit Fraction (`fitFractionOf`), no silence (`silenceOf`), no Closing Date, no Location
- [x] Ties keep newest added
- [x] Text columns compare case-insensitively and locale-aware
- [x] Status sorts in `JobStatus.options` order
- [x] Fit sorts by the ratio of the Fit Fraction
- [x] Closes is a plain date order: past dates first, whatever the Status
- [x] Salary groups by currency — the most common currency across the **whole** list first (not only what the filters admit), then the others by count, alphabetical on a tie, then no currency — and within a group by the ranking value from issue 01, in the chosen period. Reversing reverses within groups, not the group order
- [x] `today` is an argument, as it is for `matching`
- [x] The choice is remembered in browser storage, reading anything unrecognised as none
- [x] Unit tests cover each column in both directions, blanks in both directions, ties, the click cycle, currency grouping (including a tie in counts and a filtered list whose most common currency differs from the whole list's), and a passed Closing Date on an applied Job Application

## Comments

Built as `lib/dashboard/sorting.ts`: `SORT_COLUMNS`, `NATURAL_DIRECTION`,
`nextSort`, `ordered`, and `storedSort` / `sortFrom` for storage, with 29
tests. The remembered choice is `useDashboardSort` (see issue 02's comments),
not yet used by any component.

Decisions worth naming for issues 04 and 05.

**The shape.** `DashboardSort` is `{ column, direction } | null`, where
direction is `"ascending" | "descending"` rather than natural/reversed, so it
maps straight onto `aria-sort` and onto the dropdown's "highest first" /
"lowest first". The columns are `company`, `jobTitle`, `location`, `salary`,
`fit`, `status`, `silence`, `closes`, `excitement`.

**`ordered(shown, sort, { everything, period, today })`.** `everything` is
the unfiltered list, which the salary groups are counted over. It returns a
new array, and returns the list unchanged for `null`.

**Blanks.** A rank is `{ group, value } | null`; `null` goes last in both
directions and `group` is never reversed, which is how salary reverses within
its currency groups. Unrated Excitement is a blank too: the table draws a dash
and `excitementDescription` says "a rating nobody has given is not the lowest
one". `CONTEXT.md` still says "Nought is a rating rather than a blank", which
predates the nullable field and is worth bringing into line separately.

**Salary groups.** Only a Job Application with a salary counts toward its
currency; a currency beside no figure quotes nothing. A currency missing from
`everything` goes after the counted ones rather than above them. Currencies
are compared as recorded, so `pln` and `PLN` are two groups.

**Text.** One `Intl.Collator("en-GB", { sensitivity: "base" })`, fixed for the
reason `lib/day.ts` fixes its locale: the server and the browser must agree.
