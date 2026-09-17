# 04: Sorting the table

**What to build:** An arrow control on every table heading that sets the
dashboard's sort, and the table drawn in that order.

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [ ] Every heading, Salary included, is a button that advances the click cycle from issue 03
- [ ] The sorted column shows an arrow for its direction; the others show a faint affordance on hover and focus only, so a table at rest does not read as eight arrows
- [ ] The sorted heading carries `aria-sort`, and each button's accessible name says what clicking will do next
- [ ] The dashboard orders the filtered list once and hands the same ordered list to whichever view is showing, so switching views keeps the order
- [ ] Changing the salary period re-ranks a salary sort
- [ ] Follows `docs/design-system.md`
- [ ] An end-to-end check: sort by a column, reload, the sort is still applied

## Comments
