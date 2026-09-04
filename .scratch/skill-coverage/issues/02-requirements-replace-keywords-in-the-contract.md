# 02: Requirements and Necessity replace keywords

**What to build:** The shared contract stops describing a Posting's asks as a flat `keywords` array and starts describing them as Requirements, each carrying a Necessity. Existing rows keep their data. This is the cut every other issue in this effort depends on.

**Blocked by:** —

**Status:** ready-for-agent

- [x] `Necessity` is a closed set of `required`, `preferred` and `unstated` in the shared contract, in the same style as `JobStatus` and `RemoteType`
- [x] `Coverage` is a closed set of `have`, `partial` and `missing` in the shared contract
- [x] `Basis` is a closed set of `profile` and `tailored-cv` in the shared contract
- [x] A Requirement is a skill string plus a Necessity; a Job Application carries a list of them in place of `keywords`
- [x] `keywords` is removed from the contract entirely — no alias, no deprecation window, no acceptance of it on write
- [x] The database enums are derived from the contract's sets rather than retyped, so that adding a value is a migration rather than a silent drift
- [x] A migration creates a Requirements table, one row per Requirement of one Job Application, and folds every existing `keywords` entry into a Requirement with Necessity `unstated`
- [x] The migration drops the `keywords` column only after the fold
- [x] Requirement rows carry the Basis of their Coverage readings; nothing in this effort writes anything but `profile`
- [x] The Requirements table holds the three Coverage readings side by side — normalised, analysed with its reason, and overridden — each nullable

## Comments

Implemented. The Requirements table carries `user_id` like every other table,
and every query for a Requirement names its owner — ADR-0001 admits one
exception and this is not it, so scoping a Requirement only through its Job
Application's foreign key would have been an ADR override recorded in a code
comment. The foreign key stays on top of that and cascades.

Three things the checklist implies but does not spell out, done here because
the cut cannot land without them:

- **The repository reads and writes the Requirements table.** A `JobApplication`
  carries a Requirement list, so something has to fill it; returning an empty
  one would have made every read lie about a Job Application whose keywords the
  migration had just folded, and dropping the write would have made the
  contract accept Requirements that then vanished. Creating and patching a Job
  Application replace the whole list in one transaction with the row. Issue 05
  still owns the refusal message for an unknown Necessity, the detail page's
  section, hand entry, and the tenant-isolation tests.
- **The extraction provider folds its flat list into `unstated` Requirements.**
  Its response schema still asks for one array of strings, so a Requirement it
  yields records that a Posting named something and not how badly it wanted it
  — which is exactly what `unstated` means, and the same claim the migration
  makes about a folded keyword. Issue 04 splits the schema into three arrays
  and teaches the prompt to read the Necessity.
- **The keywords box is gone from both forms.** The dashboard's
  `JobApplicationEdits` is now the text fields only, because a comma-separated
  box cannot say how badly a Posting wants something; the side panel carries
  the extracted Requirements through to the save untouched. Issue 06 gives the
  panel its grouped read-only display and the pointer to the dashboard.

Two consequences worth naming before the next tickets land:

- **Between this and issue 05 there is no way to see or edit a Job
  Application's Requirements in the web app.** The keywords box is gone and the
  Requirements section does not exist yet. The data is stored and returned by
  the API throughout.
- **Production is not migrated.** Migrations are applied by hand from a
  developer's machine (README, `docs/setup/deployment.md`), and this one drops
  a column, so it wants a deliberate run rather than a side effect of this
  change. The dev project is migrated, and the fold was validated against it in
  a rolled-back transaction first.

`keywords` is removed from the contract rather than refused on write: an
unknown key is stripped, as it is for every other field, so a client still
sending one gets a Job Application with no Requirements rather than an error.
There is no such client — the extension is unpacked with a pinned ID and is
rebuilt in this change.
