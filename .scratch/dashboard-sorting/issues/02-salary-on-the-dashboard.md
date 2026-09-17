# 02: Salary on the dashboard

**What to build:** The period picker in the toolbar, the Salary column in the
table, and the salary line on the board card — all reading the Salary
Equivalent from issue 01.

**Blocked by:** 01

**Status:** done

- [x] A period picker — year / month / day / hour — in the dashboard toolbar beside the View control, in the same `Segmented` style, starting on month
- [x] The choice is remembered in browser storage the way `use-dashboard-view.ts` remembers the view: a stored value that is not a period reads as the default, and a browser that refuses storage keeps the choice for the tab. If a second (and, with issue 03, a third) remembered preference makes the external-store pattern worth sharing, share it rather than copying it
- [x] Table: a **Salary** column after Location showing the short form, with the `≈` carrying the hover text; a dash where no salary is recorded. The column comment in `job-application-table.tsx` says why it sits there
- [x] Board card: the short form on one line; nothing where no salary is recorded, so a card without one does not grow a dash
- [x] The detail view, side panel and Conversation context are unchanged
- [x] Follows `docs/design-system.md` for type, colour and spacing
- [x] The hover text is reachable without a pointer (focusable, or exposed as an accessible description)

## Comments

Built as `app/dashboard/salary-figure.tsx`, drawn in the table's Salary column
and on the board card, with the picker in the toolbar beside View.

**The storage pattern is shared.** `app/dashboard/remembered.ts` is a factory,
`rememberedChoice({ key, from, written })`, and
`app/dashboard/use-dashboard-preferences.ts` makes the three hooks from it:
`useDashboardView`, `useSalaryPeriod` and `useDashboardSort`.
`use-dashboard-view.ts` is gone. The server renders `from(null)`, so each
reader decides its own default. The period's reader is `periodFrom` in
`lib/dashboard/period.ts`.

**The period is passed down, not read by the card.** `period` goes from the
dashboard to `Board`, `Column`, both cards and the table, so issue 04 already
has it where it orders the list.

**The hover text without a pointer.** The `≈` is `aria-hidden`, carries the
`title`, and the same sentence follows the label as `sr-only` text. A card is
a link, so nothing inside it can take focus; a screen reader gets the
sentence, but a sighted keyboard user does not see the tooltip.

**Picker wording.** Its group is labelled "Salary Period" (`CONTEXT.md` avoids
"per"), and its options capitalise `SALARY_PERIOD_LABELS` rather than restate
them. `docs/design-system.md` now describes the salary line, the column and
the toolbar.
