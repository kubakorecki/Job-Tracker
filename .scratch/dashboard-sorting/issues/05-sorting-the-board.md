# 05: Sorting the board

**What to build:** A "Sort: …" dropdown in the dashboard toolbar, shown with the
board, that sets the same sort the table headings set. The board orders each
Status column by it.

**Blocked by:** 04

**Status:** done

- [x] The dropdown is a native `select`, like the Status filter, listing "Newest added" and every column but Status, each in both directions (e.g. "Salary, highest first" / "Salary, lowest first")
- [x] It shows the current sort. If the table left the sort on Status, it reads "Newest added" and the board keeps arrival order, because Status is already the board's columns
- [x] Each column's cards follow the ordered list `groupByStatus` receives, so no sorting happens in `board.tsx` itself
- [x] Dragging a card to another column still changes only its Status; it lands where the sort puts it
- [x] Follows `docs/design-system.md`

## Comments

Built in `app/dashboard/dashboard.tsx`, with the options in
`lib/dashboard/sort-words.ts`: `BOARD_SORT_COLUMNS`, `BOARD_SORT_OPTIONS`
and `boardSortOf`.

**Where it stands.** On the right of the toolbar, before the Salary Period,
and only while the board is showing. It orders rather than narrows, so it
stands with the choices about how the list is read, not among the filters.
It is 220px, the widest the toolbar holds on one line at 1440px, and enough
for "Sort: Excitement, highest first".

**The values.** Each option's value is `storedSort` of its sort, and a choice
is read back with `sortFrom`, so the select and browser storage share one
format. `boardSortOf` reads a Status sort as `null`, so the select shows
"Newest added". The list the board receives is still sorted by Status, and
within a column that is arrival order anyway: every card there has the same
Status, so ties keep newest added.

**Nothing sorts in `board.tsx`.** `groupByStatus` keeps the order it was
handed, and the Board's comment now says so. A drop changes the cached Job
Application's Status in place, and the dashboard re-orders, so the card lands
where the sort puts it.
