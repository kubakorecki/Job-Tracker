# 02: Salary on the dashboard

**What to build:** The period picker in the toolbar, the Salary column in the
table, and the salary line on the board card — all reading the Salary
Equivalent from issue 01.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] A period picker — year / month / day / hour — in the dashboard toolbar beside the View control, in the same `Segmented` style, starting on month
- [ ] The choice is remembered in browser storage the way `use-dashboard-view.ts` remembers the view: a stored value that is not a period reads as the default, and a browser that refuses storage keeps the choice for the tab. If a second (and, with issue 03, a third) remembered preference makes the external-store pattern worth sharing, share it rather than copying it
- [ ] Table: a **Salary** column after Location showing the short form, with the `≈` carrying the hover text; a dash where no salary is recorded. The column comment in `job-application-table.tsx` says why it sits there
- [ ] Board card: the short form on one line; nothing where no salary is recorded, so a card without one does not grow a dash
- [ ] The detail view, side panel and Conversation context are unchanged
- [ ] Follows `docs/design-system.md` for type, colour and spacing
- [ ] The hover text is reachable without a pointer (focusable, or exposed as an accessible description)

## Comments
