# 06: Table view and client-side search

**What to build:** The user can switch between the board and a dense table, and find a specific Job Application among many by typing.

**Blocked by:** 04

**Status:** ready-for-agent

- [x] A table view lists Job Applications densely as an alternative to the board
- [x] A toggle switches between board and table
- [x] The chosen view is remembered across sessions in browser storage, not the URL
- [x] Search matches company or job title and updates as the user types, with no debounce and no loading state
- [x] Filtering by Status is available in both views
- [x] Search and filtering run entirely client-side against the single cached list, so the board and the results can never disagree
- [x] Clearing the search restores the full set

## Comments

Implemented in `apps/web`:

- `app/dashboard/dashboard.tsx` is the new owner of the dashboard. It reads the
  one `['job-applications']` cache and hands the board and the table what is
  left of that list once the search and the Status filter have had their say,
  so the two views and the results are the same list narrowed twice over rather
  than two things to keep in step. The board went back to being a board: it
  takes the Job Applications it should show and reports a drop upwards.
- `lib/job-applications/filtering.ts` is the narrowing itself — arithmetic over
  a list, with no cache and no component in sight, and nine tests on it.
  Whitespace-only search admits everything, which is what makes clearing the
  box restore the full set rather than a special case someone has to remember.
- `lib/dashboard/view.ts` holds the two views and reads a stored preference
  back; `use-dashboard-view.ts` is the browser half.

Decisions worth knowing about:

- **The move, and its failures, moved up out of the board.** Ticket 04 put
  `useMoveJobApplication` in `Board`, which was sound while the board was
  always mounted. It is not any more: switching to the table would unmount the
  hook, destroying an on-screen failure banner and its retry — and a move that
  failed while the user was in the table would roll the card back in the cache
  with no explanation at all, which is the silent revert ticket 04 exists to
  prevent. The mutation is owned by `Dashboard` and the banners render above
  the view switch, so a move outlives the view it was made in.
- **The banner names the company from the whole list, not the narrowed one.**
  Resolving it from what the board is showing would degrade the message to
  "that Job Application" the moment the user typed a search the failed card
  does not match — and the point of that banner is that it survives however
  the board has moved on.
- **Browser storage is read as an external store, not in an effect.**
  `useSyncExternalStore` with a server snapshot is what keeps the server's HTML
  and the browser's first render agreeing; reading storage during render cannot,
  and reading it in an effect is a cascading render the lint rule rightly
  refuses. A browser that refuses to store anything still toggles — the choice
  simply does not outlive the tab.
- **No Status sentinel.** The filter's Status is `JobStatus | null`, not a
  magic `"any"` sharing a namespace with real Status values; the select maps
  its empty option to null, which is the one place that translation belongs.
- **A count above the views, said out loud.** With no debounce and no spinner
  there is otherwise nothing to tell the user their typing did anything,
  particularly when it matched nothing. It is `aria-live="polite"` for the same
  reason. Loading and empty states proper are ticket 14's.
- **A Status filter does collapse the board to one populated column.** The
  ticket asks for filtering in both views, and this is what filtering a board
  by Status honestly looks like; the pipeline shape is what the unfiltered
  board is for.
- **The table shows Location, which the search does not match.** Density is the
  table's whole purpose, and the search box says what it searches. Widening the
  search to every column is not what the ticket asked for.

Eighty-six tests in `apps/web`, twelve of them new: nine on the narrowing —
company, job title, case, whitespace, clearing, Status, the two together, and
the order left alone — and three on what a stored view preference reads as,
including the value some earlier version of the dashboard might have left
there. Typecheck, lint and build are clean.

Reviewed on both axes before committing. The spec pass caught the failed-move
state being conditionally mounted, which is the fault fixed above; the
standards pass caught the Status sentinel, a mysterious test helper, the
duplicated `onChange` shape, a magic `colSpan`, and a doc comment restating an
argument `use-job-applications.ts` already makes — all folded in.

**Still needs a human**: toggling between the views, typing in the search and
watching the results follow, and confirming the chosen view is still there
after a reload, which needs the dev account's password. Per the spec's testing
decisions there is no seam for React components, so the controls are verified
by hand; the narrowing beneath them, and what a remembered view reads as, are
covered by the tests.
