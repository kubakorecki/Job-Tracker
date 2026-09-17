# 01: A Status Change on every move

**What to build:** The history behind a Status — one row per move, written wherever a Status is set.

**Status:** done

- [x] A `status_changes` table: id, `user_id`, `job_application_id` (cascading), the Status, and when. No foreign key into `auth.users`, like every other table (ADR-0001)
- [x] A `StatusChange` in the shared contract
- [x] Every move of a Status records one — the detail view, the board's drag, the table, creation by hand, and creation from the extension. Creating a Job Application at a Status records that Status
- [x] Rows are append-only: nothing edits or deletes one, and a move back is its own row
- [x] No backfill migration (ADR-0010)
- [x] `ActivityEvent` and `ActivityEventType` deleted from `@repo/schema` — a dead v1 contract with no table behind it, and the name now misleads

## Comments

Built as the `status_changes` table in `apps/web/lib/db/schema.ts`, migration
`drizzle/0012_charming_vermin.sql`, a `StatusChange` in `@repo/schema`, and a
new repository at `apps/web/lib/status-changes/repository.ts`, with ten tests
in `repository.test.ts`.

**Recorded at one seam, not five.** The ticket lists five places a Status is
set, and every one of them reaches it through `createJobApplication` or
`updateJobApplication` — `insert(jobApplications)` and
`update(jobApplications)` appear nowhere else in the tree. So the recording
lives in those two functions, inside the transactions they already open: a
move that was recorded but did not happen, or happened and was not recorded,
are both worse than a move that failed outright. Creation records the Status it
was saved at, `bookmarked` included.

**The wording of bullet three changed, from "every write that sets a Status"
to "every move of a Status".** The code records a row only where the Job
Application actually moved: a form saved with an untouched Status, or a card
dropped back into the column it came from, writes nothing. A row for a write
that moved nothing would print in the report's third column as `Odmowa` in a
month where nothing came back. `spec.md` and ADR-0010 both say "every move",
so this is the ticket catching up with them rather than a decision taken here.
The check was made worth making: the board already refuses a same-column drop
client-side, but the extension's dropdown does not.

**"The table" turned out to be vacuous.** `job-application-table.tsx` draws a
read-only `StatusBadge`; the table sets no Status today. Nothing to wire, and
nothing missing.

**How "it moved" is known.** `statusBefore` reads the row `for update` inside
the transaction that is about to move it, so nothing can move it between the
reading and the write. Only a patch that names a Status pays for the statement.

**`changed_at` is the transaction's `now()`**, so `recordStatusChange` is
called at most once per transaction — the same thing that keeps `said_at` an
order on a Message. A caller wanting two moves in one transaction would have
to say which came first rather than leave it to the clock.

**No index for the report yet.** The one index serves one Job Application's
history, oldest first. The Activity Report's own question — a month of one
user's moves across every Job Application — cannot use it, because a btree
cannot range-scan `changed_at` while skipping the column before it. That index
belongs with that query, in ticket 04.

**`statusChangesFor` is read surface this ticket did not ask for.** It is the
read half ADR-0010 names, tickets 03 and 04 want it, and it is the only honest
door for proving that the appends happened. No endpoint and no UI.

**Also removed:** `README.md` advertised `ActivityEvent` as a shape in
`packages/schema`. `job-tracker-spec.md` mentions it too, and was left alone as
a frozen v1 document.
