# 06: The side panel shows Requirements

**What to build:** The extension's review form has one comma-separated "Keywords" box. With `keywords` gone it needs to show Requirements instead — grouped and read-only, because the panel's job is to save a Posting in seconds, and three labelled boxes in a narrow panel fights that.

**Blocked by:** 02, 04

**Status:** ready-for-agent

- [x] The review form shows extracted Requirements grouped by Necessity, read-only
- [x] The form no longer has a keywords field, and nothing sends `keywords`
- [x] The panel points the user at the dashboard for correcting Requirements
- [x] Company, job title and the other fields stay editable in the panel exactly as they are today
- [x] A Draft with no Requirements shows nothing rather than three empty headings
- [x] Saving from the panel persists the Requirements as extracted
- [x] The extension builds against the new contract and is rebuilt as part of this change

## Comments

Implemented. Issue 02 had already taken the keywords box out of the review
form and carried the extracted Requirements through the save untouched, so
what was left here was the showing: a read-only grouped list, the pointer to
the dashboard, and a rebuild.

**The grouping rule moved into the contract.** `groupedByNecessity` was in
`apps/web/lib/job-applications/requirement-edits.ts`, over rows that carry an
editing key; the panel needs the same rule over the contract's own
Requirements, and the two surfaces cannot import each other — the same reason
`NECESSITY_LABELS` went to `@repo/ui` in issue 05. It is now generic over
anything carrying a Necessity and lives in `@repo/schema`, for the reason
`nearDuplicatesOf` is there: a domain rule both the dashboard and the panel
read. It sits in `index.ts` rather than in a module of its own like that one,
because it is the closed set's order that it reads — `Necessity.options` is
declared eight lines above it, and a separate module would have to import the
index that re-exports it. The web's copy and its tests are gone; the rule is
tested once, in `packages/schema/src/index.test.ts`.

**`DraftRequirements`, not `ExtractedRequirements`.** `CONTEXT.md` tells the
Draft entry to avoid "extraction", and the same form is manual entry, where
nothing was extracted from anything.

**Read-only, and it says why in one line.** "Correct these in the dashboard
after saving." A Requirement is a skill and a Necessity together, so editing
one in the panel means three labelled lists with a dropdown against every line
in a column narrow enough to wrap each of them — against a panel whose job is
to save a Posting in seconds. There is no link on that line: the Job
Application does not exist yet, so there is no page to point at, and the
header's Dashboard link is a permanent fixture two lines above.

**Nothing at all when nothing was asked.** Not a heading over a blank space,
not one empty group — a Posting that names no skills is an ordinary Posting
(issue 04), and an empty section would read as an extraction that failed.
Manual entry opens the same form with the same empty list, so it shows nothing
there either; a referral's Requirements are typed on the dashboard.

The skills are keyed by position rather than by their wording: the list is
rendered once from a Draft the user cannot edit, nothing is added, removed or
reordered, and two lines of a Posting can name the same skill twice.

Verified by 209 web tests and 53 contract tests, by a full `pnpm build` —
which is the rebuild the last box asks for; `.output/` is gitignored, so the
unpacked extension on disk is current — and by rendering the list outside the
panel for all three cases: every Necessity, one Necessity, and none.
