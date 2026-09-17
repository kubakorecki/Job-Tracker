# 03: The order of the dashboard

**What to build:** The sort orders as a pure module in `apps/web/lib/dashboard/`
(beside `view.ts`), and the remembered sort choice. It orders a list the
filters have already narrowed, the way `matching` in `filtering.ts` narrows
one. Nothing in the interface yet. See the spec's "Sort orders".

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] A sort is a column and a direction, or none. None is newest added, the order the list already arrives in
- [ ] The sortable columns: company, job title, location, salary, fit, status, silence, closes, excitement — each with its natural first direction from the spec
- [ ] The click cycle as a pure function: none → natural → reversed → none, and clicking a different column starts that column at its natural direction
- [ ] Blanks last in both directions: no salary, no Fit Fraction (`fitFractionOf`), no silence (`silenceOf`), no Closing Date, no Location
- [ ] Ties keep newest added
- [ ] Text columns compare case-insensitively and locale-aware
- [ ] Status sorts in `JobStatus.options` order
- [ ] Fit sorts by the ratio of the Fit Fraction
- [ ] Closes is a plain date order: past dates first, whatever the Status
- [ ] Salary groups by currency — the most common currency across the **whole** list first (not only what the filters admit), then the others by count, alphabetical on a tie, then no currency — and within a group by the ranking value from issue 01, in the chosen period. Reversing reverses within groups, not the group order
- [ ] `today` is an argument, as it is for `matching`
- [ ] The choice is remembered in browser storage, reading anything unrecognised as none
- [ ] Unit tests cover each column in both directions, blanks in both directions, ties, the click cycle, currency grouping (including a tie in counts and a filtered list whose most common currency differs from the whole list's), and a passed Closing Date on an applied Job Application

## Comments
