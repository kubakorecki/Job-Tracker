# 05: The report, edited

**What to build:** The page where the user finishes the document.

**Status:** done

- [x] Every cell editable; rows can be added and deleted, not reordered, with added rows last
- [x] A free `Uwagi` block under the table
- [x] Polish or English, chosen before generating: headings, the generator's wording and date formats translate, the user's own text does not. Switching regenerates after confirming
- [x] Fewer than three rows warns, in the view only, and never blocks printing. Added rows count
- [x] `localStorage` holds the name, the last language, and the draft per month and language; "Generate again" discards the draft. Nothing is sent to the server
- [x] The name is typed once and remembered

## Comments

The page is `/dashboard/report`: a server component that reads the record and
hands it over, and a client tree that does everything else —
`activity-report.tsx` for the state and the toolbar, `report-sheet.tsx` for the
document. It is reached from the app bar, beside Your Profile, because it is a
destination the user visits once a month rather than an action on a page.

**There is no endpoint behind any of it, and there is not meant to be.** The
report is proposed in the browser, edited in the browser, stored in the browser
and printed by the browser. That is not an optimisation: an Activity Report is
never stored (`CONTEXT.md`), and the moment a draft went to a server it would
be a record of a document, which is the thing the whole feature refuses to be.

**The server renders no report at all, on purpose.** A month's boundaries are
the reader's zone, which a server rendering in the host's zone cannot know, so
the page draws `Loading your month…` and the browser fills it in as it
hydrates. `useBrowserDay` is a `useSyncExternalStore` whose server snapshot is
`null` — the same shape `rememberedChoice` uses for a preference, and for the
same reason: the way to make the server's HTML and the browser's first render
agree is to have the server render its own honest answer rather than a guess
hydration then corrects.

**The draft is read through a store rather than synchronised into state.**
`use-draft.ts` holds what has been read or written, keyed by month and
language, and the page reads it with `useSyncExternalStore`. The first attempt
was an effect that set state when the month changed; `react-hooks/set-state-in-effect`
refused it, and it was right to — a draft loaded one render behind its month is
a document that lags the selector above it. Every keystroke writes through to
`localStorage`, because a draft is small, storage is synchronous, and saving on
a timer is how a document loses its last sentence to a closed tab.

**Only an edited report is ever stored.** A report exactly as it was proposed is
not a draft; it is what generating again would produce anyway, and storing one
would leave a stale copy standing in for a month the user has since recorded
more of.

**The two languages are two documents, and switching keeps both.** The draft is
filed per month _and_ language, so the Polish the user typed is still there when
they switch back — which is exactly what the confirmation says, because a user
expecting a translation would otherwise think they had lost it. Nothing is asked
while there is nothing of theirs to lose: switching a report nobody has touched
just switches. The comparison behind that is `sameReport`, over the rows and the
`Uwagi` only.

**"Generate again" is the one destructive thing on the page**, so it is the one
worded as a warning, and it asks only when there is something to throw away.
Both questions are inline banners rather than modals — the system has no modal
and the tokens' page has no room for one, and `window.confirm` is a piece of the
browser's interface in the middle of a document.

**Removing a row asks nothing.** A report is a draft of a document rather than a
record of anything, and "Generate again" puts back any row a slip took away. The
control is a 28px icon button in the corner of the first cell rather than a
fourth column, so the table on screen is the same three columns as the table on
paper.

**The name is not part of the report.** It is the same name every month, so it
is remembered on its own key and rendered into the header — which is also why
switching language or generating again never touches it. Empty is a real
answer: a sheet printed before it is typed has a visible blank where the office
expects a name.

**The cells are quiet boxes that grow with what is typed into them**, sized from
the lines they hold rather than measured after every keystroke. `QUIET_BOX` in
`app/form.tsx` is new and states no height, for the reason written up there: a
height stated in the constant cannot be overridden by a class beside it, because
Tailwind settles equal specificity by the order of its own stylesheet.

**The shortfall notice is `ember` and never blocks anything.** How many contacts
a month needs is between the user and the office; a tracker that refused to
print would be the wrong thing standing in the way. It counts rows, so rows
added by hand count, and it is `print:hidden` — 06's rule that nothing of the
application prints.

**One thing to watch.** The month in the toolbar is named in the report's
language while the app around it speaks English — "Nothing is recorded for
kwiecień 2026". It is deliberate: the selector chooses the document's month and
the sheet's header names it the same way, so the user never reads two names for
one month. It is the only place the two registers meet, and worth revisiting if
it reads as a translation bug rather than as a choice.

**From review.** Three things the two review axes caught, all fixed here:

- **"Generate again" could not reach the record as it now stands.** It
  discarded the draft and re-proposed from the props the page came down with,
  so a contact recorded in another tab since was nowhere in the sheet it handed
  back — which is most of the reason for pressing it. It now calls
  `router.refresh()` as well, and the server component's new answer arrives as
  an ordinary render.
- **The language banner said something that was only sometimes true.** It read
  "The report is generated again in English", but where an English draft was
  already filed the page restores that instead of generating anything. It now
  says what is true either way: the other language is a separate sheet, and
  nothing of theirs is translated into it.
- **The wait every reader sees had no skeleton.** `loading.tsx` had one, but
  that is the cold-route wait; the one on the page — the moment before the
  browser has said what zone it is in, which every reader passes through
  (ADR-0012) — was a written line alone, against the design system's rule that
  a wait is a skeleton _plus_ the line.

Also from review: the question standing is now two shapes rather than a
`Language | "again"` sharing one slot, and the name's storage key moved out of
`lib/activity-report/draft.ts` — the name is not part of the draft, and nothing
in `lib` reads it.
