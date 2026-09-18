# 06: The report, printed

**What to build:** The A4 sheet that comes out of the browser's own Save as PDF.

**Status:** ready-for-human — the sheet is built and Chrome is verified; what
is left is one minute in Safari, which an agent cannot drive. See the last
section of the comments.

- [x] A print stylesheet for A4: the three columns of the office's form, headings repeating across pages, rows unbroken
- [x] The header carries the month and year, the user's name, and the day it was generated. No signature line
- [ ] The Posting's link is shortened on the page and still a real link in the PDF — verify in Chrome and Safari, and record what each does in the comments here (**Chrome verified; Safari is the one thing left, and needs a human at the GUI**)
- [x] Nothing of the application's own interface prints: no navigation, no buttons, no warning

## Comments

The stylesheet is a `@media print` block at the foot of `apps/web/app/globals.css`,
written **outside `@layer`** on purpose: Tailwind's utilities are layered, and an
unlayered rule beats a layered one whatever the order, so the sheet's sizes and
rules win over the classes the same elements wear on screen without an
`!important` anywhere. `@page` is A4 at a 15mm margin; the sheet sets 10pt over
1.35, cells 9.5pt with a 1px `ink` rule; `thead` is stated as
`table-header-group` and every `tr` is `break-inside: avoid`.

**The palette had to be told that paper is paper.** A reader who prefers a dark
theme would otherwise print pale ink on a ground the printer declines to lay
down. `packages/tailwind-config/shared-styles.css` now names the light values
`--day-*`, exactly as it already named the dark ones `--night-*`, and maps them
onto `:root` three times: by default, and again under `@media print` after the
dark block. One copy of every colour, which is what that file's own comment asks
for. `.night` comes after and keeps winning, being a surface that means to be
dark and is never printed.

**Each cell is drawn twice.** A textarea is a piece of this application's
interface: printed, it carries its own border and its own scrollbar and clips
whatever did not fit the height it happened to have. So every cell renders the
control for the screen and a `print:block` div of the same words for the sheet,
and the same trick keeps the name in the header and the `Uwagi` block — which
prints only when it says something. The bar is `print:hidden`, `PageBody` drops
its 64px gutters to `print:p-0` so the `@page` margin is the only one, and the
toolbar, the shortfall notice, the row controls and "Add a row" all go.

**The header is the month, the name and the day, and no signature line.** The
day is **today** rather than a generation stamp carried in the draft. They are
the same thing except for a draft picked up days later, and there the honest
answer is the day it is being drawn up — which is what the Polish says:
`Sporządzono dnia`. It also keeps the day out of the stored draft, so the
comparison that decides whether the user has typed anything is about their
words rather than about the date rolling over at midnight.

### What the two browsers do with the link

The sheet prints `<a href="{the address the user recorded}">{the shortened
form}</a>`: `example.com/jobs/senior-engineer` rather than two hundred
characters of tracking parameters, with the whole address still in the `href`.
The query string is dropped from the shown form — on a job board it says where
the user was standing when they clicked and nothing about the job — and kept
only where a Posting has no path to be identified by.

**Chrome: verified, and it keeps the link.** Driven with Playwright against the
real page and the real stylesheet — sign in, record three Job Applications
applied for last month, open `/dashboard/report`, then
`page.pdf({ preferCSSPageSize: true })`, which is Chrome's own print path:

- `/MediaBox [0 0 594.95996 841.91998]` — A4 at 595 × 842pt, so `@page size: A4`
  is what governed rather than Playwright's Letter default.
- The file carries `/Annots` with `/Link` subtypes and one
  `/URI (https://…?sug=sr_top&utm_source=board)` per row — the **whole**
  address, not the shortened text. The link the office receives is live and goes
  where the user's record points.
- A print-media screenshot of the same page shows the three-column form, the
  Polish headings and dates, and nothing of the application around it.

**Safari: not verified.** It cannot be driven headlessly, and its print sheet is
a GUI the agent should not be reaching into on somebody's machine. What is known
is that WebKit's Save as PDF has historically not written link annotations; if
that still holds, the office gets the shortened text as text. That is legible
but not typeable back in when it has been elided, which only happens past 44
characters — most job URLs come in under it once the query is gone.

**To settle it takes a minute**: open `/dashboard/report` in Safari, ⌘P, Save as
PDF, and open the file in Preview — if the address is clickable, Safari keeps
links and there is nothing to do. If it does not, the fix is a line: print the
whole address rather than the shortened one when it is short enough to be typed
back in, or print the address under the shortened form on paper only. Neither
touches anything but `link.ts`.
