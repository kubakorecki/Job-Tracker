# 04: Sorting the table

**What to build:** An arrow control on every table heading that sets the
dashboard's sort, and the table drawn in that order.

**Blocked by:** 02, 03

**Status:** done

- [x] Every heading, Salary included, is a button that advances the click cycle from issue 03
- [x] The sorted column shows an arrow for its direction; the others show a faint affordance on hover and focus only, so a table at rest does not read as eight arrows
- [x] The sorted heading carries `aria-sort`, and each button's accessible name says what clicking will do next
- [x] The dashboard orders the filtered list once and hands the same ordered list to whichever view is showing, so switching views keeps the order
- [x] Changing the salary period re-ranks a salary sort
- [x] Follows `docs/design-system.md`
- [x] An end-to-end check: sort by a column, reload, the sort is still applied

## Comments

Built in `app/dashboard/job-application-table.tsx` (`SortHeading`) and
`app/dashboard/dashboard.tsx`, with the words in a new pure module,
`lib/dashboard/sort-words.ts`, and one end-to-end check in
`e2e/smoke.spec.ts`.

**The words are their own module.** `sort-words.ts` sits beside
`sorting.ts`, which stays the arithmetic: `SORT_COLUMN_LABELS`,
`sortLabel`, `headingAction` and `ariaSortOf`, tested in
`sort-words.test.ts`. The components have no unit tests; that seam was
agreed.

**Accessible names say the next click.** "Sort by Salary, highest first", then
"Sort by Salary, lowest first", then "Stop sorting by Salary, back to newest
added". Each direction is worded in its column's terms: A to Z, highest first,
earliest first (Closes), most days first (Silence), pipeline order (Status).
Only the sorted heading carries `aria-sort`; the others carry none rather
than `none`.

**Ordered once.** The dashboard runs `ordered(shown, sort, { everything,
period, today })` in one `useMemo`, with `period` among its dependencies, and
hands the result to whichever view is showing.

**The arrow.** The sorted heading turns `ink` and draws an 11px arrow. The
others draw a faint two-way arrow on hover and focus only, and it is
`invisible` rather than absent, so a heading does not widen under the pointer.
The button's `after` covers the heading cell, so the target is the cell. That
is still short of the 44px phone target: the header row is the table's own
height.

**Seen along the way, not changed.** dnd-kit numbers its
`DndDescribedBy-n` ids with a counter global to its module, which the dev
server keeps across requests, so a second server render of the board logs a
hydration mismatch. It predates this work; the new end-to-end test just loads
the board more than once.
