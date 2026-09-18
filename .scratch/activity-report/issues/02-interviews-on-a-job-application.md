# 02: Interviews on a Job Application

**What to build:** The list of meetings itself — contract, table, and the detail view that edits it.

**Status:** done

- [x] An `interviews` table: id, `user_id`, `job_application_id` (cascading), the day held, an optional time, the stage as the user words it, an optional meeting link, an optional place, optional notes, the day it was arranged, and a cancelled marker
- [x] The day held is a `date` read as a string, for ADR-0007's reason; the time is its own optional column rather than an invented instant
- [x] The day arranged defaults to today and is editable — an invitation that arrived last week is not news from today
- [x] `Interview` in the shared contract, and a Job Application reads its Interviews in date order
- [x] The detail view adds, edits, cancels and deletes them
- [x] Adding one when the Status is not `interviewing` asks whether to move it, and moves it only on a yes (ADR-0011)

## Comments

Built as the `interviews` table in `apps/web/lib/db/schema.ts`, migration
`drizzle/0013_panoramic_gabe_jones.sql`, three shapes in `@repo/schema`, a
repository, an edits module and an API module under `apps/web/lib/interviews/`,
two route files under `app/api/job-applications/[id]/interviews/`, and the
`Interviews` panel on the detail view.

**One record of fields, three shapes.** `Interview`, `CreateInterview` and
`UpdateInterview` are all derived from one `interviewFields` record, so a rule
about what a meeting may say is written once — the arrangement the Job
Application's own three shapes already have.

**`arrangedOn` is optional in the contract rather than defaulted.** Today is
not something a contract can know, and a client's clock could be anything: a
browser two years slow would date every invitation wrong, which is the argument
ADR-0007 makes about a Closing Date's year. Omitted, the endpoint stamps it
from `lib/day`'s `todayInUtc` — the one place in the app that reads today. The
form states it anyway, because it shows the day in a box the user can correct.

**The time is to the minute and no finer.** `z.iso.time({ precision: -1 })` is
what an `<input type="time">` emits, and the `time` column would otherwise read
back `14:30:00` — so `toInterview` cuts it, and the box, the contract and the
column hold one wording of a time between them.

**There is no endpoint that reads an Interview.** A Job Application carries its
Interviews, which is the one read a client makes and the one every surface
draws from; a second address answering the same list would be a second thing to
keep in step. The three writes each answer with the meeting they wrote, so the
page never has to go and look again.

**Calling a meeting off is a patch, not an address of its own.** A cancelled
meeting keeps its place and every detail it had, which is exactly what a patch
of one field does and what a dedicated endpoint would have to be careful not to
undo. Deleting stays for a meeting recorded by mistake, and the confirmation
says which of the two to reach for.

**Every repository function names the Job Application as well as the user**,
though a row's own id would find it. It is what stops a meeting being corrected
or removed by addressing it through a Job Application it is not on, and it lets
the endpoints answer a mistyped Job Application the way every other endpoint
answers one — the arrangement `setOverriddenCoverage` already makes for a
Requirement.

**The prompt is a question and nothing else** (ADR-0011). The panel asks; the
page patches. `onMoveToInterviewing` on the detail view is the same patch the
Status select sends, and the select follows the answer — the form is measured
against the saved Job Application, so a box left reading Applied behind a Job
Application that now stands at Interviewing would move it back on the next
press of Save. Nothing in `lib/interviews/` can write a Status at all.

**The prompt is put away by an answer either way.** Found in review: `asking`
was set when a meeting was arranged and cleared only by "Leave the Status
alone", so a move that landed left it standing. The guard hid it while the Job
Application sat at Interviewing — and brought it back the next time the Status
moved off, with no meeting just arranged to ask about, which is exactly the
nagging about a legal state that setting it on the arrangement is meant to
avoid. A refusal still leaves it standing, because then the question really is
open.

**The Status is checked in one place, not two.** `record` now sets `asking`
unconditionally and the guard decides whether the question is worth putting.

**Open question: "meeting" against the glossary.** `CONTEXT.md` lists `meeting`
under the `Interview` entry's `_Avoid_`, and the panel's prose and buttons use
it freely — "Save the meeting", "A meeting is in the diary". Nothing names the
*concept* that way: the table is `interviews`, the type is `Interview`, the
panel is titled Interviews, the tag reads `Interview 24 Sep` and the rail says
`Interview arranged`. The glossary's own definition opens "One meeting in one
Job Application's recruitment", so the word is being used as English rather
than as a second name for the thing. Left as it is; worth a ruling if the
`_Avoid_` list is meant to bind prose as well as vocabulary.

**The panel holds no form of its own.** It renders inside the form the rest of
the page saves through, and a form inside a form is not a document a browser
will honour — so Enter is caught in every box, and each meeting is its own
request on the press. A diary that only took effect when somebody remembered to
press Save would be a way to lose an interview.
