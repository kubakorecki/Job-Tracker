# 05: Job detail view — edit and delete

**What to build:** The user can open a single Job Application, correct or enrich anything about it as they learn more, and remove one added by mistake.

**Blocked by:** 04

**Status:** ready-for-agent

- [x] Opening a Job Application from the board or list shows all of its fields
- [x] Every field is editable, including notes, location, salary range, currency, remote type, source and keywords
- [x] The applied date is editable by hand, so applications made before using the tool can be backfilled
- [x] Excitement is recordable on a one-to-five scale
- [x] Edits persist across a reload
- [x] A Job Application can be deleted, with a confirmation step
- [x] A user can neither read, edit nor delete a Job Application belonging to someone else

## Comments

Implemented in `apps/web`:

- The detail view is a route, `/dashboard/job-applications/:id`, not a dialog
  over the board. A Job Application the user is in the middle of correcting is
  worth a URL — it survives a reload, it can be linked to, and ticket 06's
  table will open the very same page rather than growing its own copy of this
  form. The page reads through the repository, scoped by the user's id
  (ADR-0001), and answers somebody else's Job Application with `notFound()` —
  the same answer the endpoint gives, so the page never confirms a stranger's
  row is real either.
- `GET` and `DELETE` join `PATCH` on `/api/job-applications/:id`, which
  completes the create/list/read/update/delete surface the spec asks for.
  `isJobApplicationId` is the guard all three share, and the detail page
  imports it: a mistyped id is a 404 rather than a Postgres cast error.
- The form holds text and only text. `lib/job-applications/edits.ts` turns a
  Job Application into that text and back into a patch, and is where the
  behaviour worth testing lives — twelve tests, no form and no database.

Decisions worth knowing about:

- **The patch names only what the user changed.** Sending all fifteen fields
  back would work; the endpoint takes a full patch happily. But it would also
  overwrite whatever the extension or another tab had written to a field this
  user never looked at, and — because a date box holds a day where the row
  holds an instant — it would quietly move the applied date to midnight every
  time an untouched form was saved. `changesFrom` compares two _forms_ rather
  than a form against a stored row, which is what makes an untouched date
  distinguishable from one the user deliberately set to that day.
- **A change the contract will refuse is kept in the patch, not dropped.** An
  emptied company reaches `UpdateJobApplication.safeParse` and comes back as
  "company: Too small", the same line the endpoint would have answered with.
  Silently dropping it would leave the user pressing Save on a form that
  never saves.
- **`excitement` is now `z.number().int()` in the shared contract.** It was
  `min(1).max(5)`, which accepted 2.5 — and the column that stores it is an
  integer, so Postgres would have rounded a number the API had just told the
  client was fine. A one-to-five scale is five values. `EXCITEMENT_SCALE` is
  exported alongside it so the control offering the steps reads them from the
  contract; the field itself stays an integer rule rather than a union of five
  literals, because a literal union would need `toJobApplication` to assert
  something the integer column does not enforce.
- **The query cache moved from the board's page to a `/dashboard` layout.**
  The board reads one cached list, and this page changes something in it — but
  a cache that dies when the user navigates to the detail view cannot be the
  one the board comes back to. It now spans both, so a save and a delete
  invalidate `['job-applications']` the same way the add form does, rather
  than relying on the board being rebuilt from a fresh server render.
- **The dashboard's form pieces live in `app/dashboard/form.tsx`.** The detail
  view is the second form on the dashboard, and the first thing it did was
  copy the add form's field, label and button. They share them now — not
  `packages/ui`, which carries its own Tailwind prefix and its own build and
  is for what more than one app needs.
- **The card is a link that is also draggable, rather than a card with a drag
  handle.** dnd-kit dresses a draggable as a button; this one is told to keep
  the anchor's link role instead, so a screen reader announces a link rather
  than a button that cannot be pressed. The pointer sensor only swallows the
  click once a drag has actually begun — four pixels of travel later — so a
  plain click opens the Job Application, and the keyboard sensor was narrowed
  to Space so Enter is left to follow the link.
- **Delete confirms inline rather than in a `window.confirm`.** The question
  names the company, the affirmative button is the one that says what it does,
  and neither is the button the user reaches for first.
- **`DELETE` answers 204 and 404, and the second delete of the same Job
  Application is the 404.** By then there is nothing there to be the caller's,
  which is the same sentence the read and the patch answer with.

Twenty new tests on the endpoints: the read endpoint (every field, another user's, one that
does not exist, an id that could never be one), the delete endpoint (removed
and stays gone, twice over, another user's, one that does not exist), the patch
across every editable field and back out through the read, clearing fields,
excitement one through five and the three ways off the scale, and backfilling
an applied date — plus nine on the contract itself and twelve on `edits.ts`.
The full suite is 116 tests, and typecheck, lint and build are clean.

Reviewed on both axes before committing. The standards and spec passes agreed
on one real fault — `router.refresh()` after a save, with a comment claiming it
was what refreshed the board. It was not: the board renders from the React
Query cache, which `router.refresh()` cannot touch, and ticket 04's record
already says the add form dropped that call for the same reason. That is what
moved the cache into the layout. The reviews also caught the duplicated form
pieces and the excitement scale being restated in the component; both are
folded in above. Left as they are: the read endpoint having no browser caller
yet — this ticket's own "a user can neither **read**, edit nor delete" is what
puts it in scope, and the extension is the caller ticket 07 brings — and the
Status and remote-type assertions in `edits.ts`, which are values the
contract's own options produced and the contract re-checks before they are
sent.

**Still needs a human**: clicking a card through to the detail view, editing in
a browser and deleting from it, which needs the dev account's password. Per the
spec's testing decisions there is no seam for React components, so the form's
behaviour is verified by hand; the endpoints beneath it, and the arithmetic
that decides what a save actually sends, are covered by the tests.
