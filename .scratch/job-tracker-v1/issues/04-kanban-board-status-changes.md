# 04: Kanban board with drag-and-drop Status changes

**What to build:** The user sees their pipeline as columns and moves a Job Application between them by dragging. The card moves immediately, and snaps back with an explanation if the change didn't save.

**Blocked by:** 03

**Status:** ready-for-agent

- [x] Job Applications appear as cards in columns grouped by Status, using the shared Status badge component
- [x] Cards show company, job title, applied date and Status
- [x] Dragging a card to another column changes that Job Application's Status
- [x] Status changes go through the general update endpoint; there is no dedicated status endpoint
- [x] Moving a Job Application to `applied` sets its applied date when that date is currently unset
- [x] Moving a Job Application backwards, or to `rejected` or `withdrawn`, never clears the applied date
- [x] The whole board is fetched under a single query key and grouped client-side
- [x] A move renders immediately, before the request completes
- [x] A failed move restores the board to its previous state and shows a message offering a retry
- [x] Retrying from that message reattempts the same change
- [x] A Status change persists across a page reload

## Comments

Implemented in `apps/web`:

- `PATCH /api/job-applications/:id` is the general update endpoint, and Status
  arrives on it like any other field. A dedicated status endpoint would need
  this one's ownership check and its applied-date rule, and the two would
  drift. `authenticatedRoute` now hands a route's dynamic segment to its
  handler alongside the user, which is also the shape tickets 05's read and
  delete will take.
- `updateJobApplication` in the repository stamps the applied date inside the
  update statement — `coalesce(applied_at, now())` — so nothing can slip
  between the check and the write. Every other move contributes no `applied_at`
  column at all, which is what makes "a move backwards, or to `rejected` or
  `withdrawn`, never clears it" a property of the statement rather than a
  branch someone has to remember.
- The board (`app/dashboard/board.tsx`) reads the one `['job-applications']`
  cache and groups by Status in the browser. Dragging is `@dnd-kit/core`:
  columns are droppables keyed by Status, cards are draggables keyed by id, and
  a `DragOverlay` carries the card under the cursor. The keyboard sensor is on,
  and the announcements name the company and the column rather than dnd-kit's
  default, which reads out a UUID.
- A move is optimistic: `onMutate` changes the card and returns what it was,
  `onError` puts that card back and records the failure, `onSettled`
  invalidates. The failure banner carries the move itself, so Retry reattempts
  that same change however the board has moved on.

Decisions worth knowing about:

- **The rollback restores one card, not a snapshot of the whole board.** The
  spec says a single cache key means one snapshot restores the board
  consistently, and the single key is the part that matters. But a snapshot
  taken before move A also predates move B, so if the user drops a second card
  while the first is in flight, A's rollback would silently take B's card back
  too. Restoring the one card that failed composes; the whole-board snapshot
  does not.
- **Failed moves are held in the hook, not read off the mutation.** A
  `useMutation` result only ever describes its latest call, so a second drop
  while the first is in flight would leave the first to snap back with no
  message at all — exactly the thing this ticket exists to prevent. Failures
  are a list keyed by Job Application, so two can be explained at once.
- **`onSettled` only invalidates when it is the last move out.** Refetching
  while another move is in flight returns a board that does not yet carry it,
  and that card would jump back until its own request landed.
- **The message is an inline banner above the board, not a toast.** The root
  spec's §6.3 says toast; this ticket says "a message offering a retry". A
  banner needs no new dependency and no portal, and it sits where the board is
  rather than over it.
- **The update endpoint keeps `normalized_job_url` in step with `job_url`.**
  Editing fields is ticket 05's, but `UpdateJobApplication` already carries
  `jobUrl`, and an endpoint that accepted one while leaving the stored identity
  stale would leave the unique index guarding the Posting the Job Application
  used to point at (ADR-0002). The 409 on a colliding patch is the same
  mapping the create endpoint already had.
- **`lib/job-applications/client.ts`** is how the browser reaches the
  endpoints, so the address and the shape of a refusal are written once. The
  add form posts through it too, and stopped calling `router.refresh()`: the
  board is a client cache now, so adding invalidates the query key instead.
- `JobApplicationList` is gone — the board replaced it. `appliedOn` moved to
  `lib/job-applications/applied-date.ts` alongside `appliedAtAfterMove`, the
  client's copy of the stamping rule, which exists only so an optimistic move
  to Applied renders a date rather than "Not applied".

Fifteen tests cover the endpoint against the dev project: the Status change and
its persistence, the stamp on a move to `applied`, an existing date left alone,
every move that must not clear it, a patch touching only what it names, 404 for
another user's Job Application and for one that does not exist, 400 for an
unknown Status and a non-JSON body, and 409 both ways round the Posting index.
The full suite is 75 tests, and typecheck, lint and build are clean.

**Still needs a human**: dragging a card in a browser, which needs the dev
account's password. Per the spec's testing decisions there is no seam for React
components, so the board's behaviour is verified by hand; the endpoint and the
applied-date rules underneath it are covered by the tests.
