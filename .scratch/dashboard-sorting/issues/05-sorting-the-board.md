# 05: Sorting the board

**What to build:** A "Sort: …" dropdown in the dashboard toolbar, shown with the
board, that sets the same sort the table headings set. The board orders each
Status column by it.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] The dropdown is a native `select`, like the Status filter, listing "Newest added" and every column but Status, each in both directions (e.g. "Salary, highest first" / "Salary, lowest first")
- [ ] It shows the current sort. If the table left the sort on Status, it reads "Newest added" and the board keeps arrival order, because Status is already the board's columns
- [ ] Each column's cards follow the ordered list `groupByStatus` receives, so no sorting happens in `board.tsx` itself
- [ ] Dragging a card to another column still changes only its Status; it lands where the sort puts it
- [ ] Follows `docs/design-system.md`

## Comments
