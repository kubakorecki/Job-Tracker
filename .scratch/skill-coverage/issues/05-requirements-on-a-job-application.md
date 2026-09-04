# 05: Requirements on a Job Application, editable

**What to build:** Requirements are stored against a Job Application, come back with it, and can be corrected, added and removed by hand — including for a Job Application that never came from a Posting.

**Blocked by:** 02

**Status:** ready-for-agent

- [x] Creating a Job Application accepts a Requirement list, and omitting it means an empty list rather than an error
- [x] Reading a Job Application returns its Requirements
- [x] Updating a Job Application can add a Requirement, remove one, change a skill's wording and change a Necessity
- [x] A Requirement with an unknown Necessity is refused with a message naming the accepted values
- [x] A Job Application with no Posting can carry Requirements, entered by hand
- [x] The detail page has a Requirements section, grouped under the three Necessities, where each can be edited and removed and a new one added
- [x] A Job Application with no Requirements says so, rather than showing an empty group
- [x] Requirements are scoped to their Job Application, and therefore to its user — a request cannot reach another user's
- [x] Tests go through the Job Applications endpoints, covering create with and without Requirements, each kind of edit, the unknown-Necessity refusal, and tenant isolation

## Comments

Implemented. Issue 02 had already built the storage and the repository's reads
and writes, so most of the endpoint half of this checklist was a matter of
proving it through the endpoints rather than building it — except for one thing
it had left broken.

**A patch that named only the Requirements failed.** Every existing test
patched a column alongside them, so nothing had ever asked the row update to
write no columns, which Postgres has no syntax for and Drizzle refuses outright
("No values to set"). It was a 500 on the single most ordinary edit this issue
adds: correcting what a job asks for and nothing else. The update now stamps
`updated_at` when the patch leaves it no column of its own — the honest answer,
since a Job Application whose Requirements changed did change, and the row
still has to come back so the caller can tell a correction from a 404.

**The Requirements save on the page's one button.** The section holds a list
rather than a box, so it sits outside `JobApplicationEdits` and has its own
arithmetic in `lib/job-applications/requirement-edits.ts`: the rows, what they
amount to as Requirements, whether they differ from what was saved, and the
grouping. Correcting what a job asks for belongs with correcting its title and
its salary, so nothing here saves on its own.

Three things worth naming:

- **A row carries a key the contract knows nothing about.** A Requirement has
  no identity — the skill identifies it, and the skill is exactly what a
  correction changes — so a row being edited needs something stabler to be held
  by. The key lives only as long as the form; `asRequirements` strips it.
- **The list stays flat and is grouped only to be read.** A Requirement keeps
  the position it was captured in, so changing a Necessity moves it between
  headings without disturbing anything else's order. A Necessity nothing is
  asked at gets no heading, and a Job Application asked nothing at all says so
  in a line rather than in three empty groups.
- **An emptied skill is kept rather than dropped,** so the contract names the
  problem — the same rule `changesFrom` already applied to an emptied company.
  Removal is a button, not a blanked box.

`NECESSITY_LABELS` went to `@repo/ui` beside the Status and remote-type labels,
because issue 06 puts the same three words in the side panel and the two
surfaces cannot import each other.

The unknown-Necessity refusal needed no code: `describeIssues` already renders
Zod's `invalid_value` as `requirements.0.necessity: Invalid option: expected
one of "required"|"preferred"|"unstated"`, which names the field and all three
accepted values. The tests assert that rather than the exact wording.

Verified by 213 passing tests, and by driving the section in a browser once —
add, correct a wording, move a Necessity between groups, remove, save, and the
empty state — with a throwaway Playwright spec that was deleted afterwards, as
this repo keeps exactly one end-to-end test on purpose.
