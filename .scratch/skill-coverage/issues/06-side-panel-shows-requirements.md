# 06: The side panel shows Requirements

**What to build:** The extension's review form has one comma-separated "Keywords" box. With `keywords` gone it needs to show Requirements instead — grouped and read-only, because the panel's job is to save a Posting in seconds, and three labelled boxes in a narrow panel fights that.

**Blocked by:** 02, 04

**Status:** ready-for-agent

- [ ] The review form shows extracted Requirements grouped by Necessity, read-only
- [ ] The form no longer has a keywords field, and nothing sends `keywords`
- [ ] The panel points the user at the dashboard for correcting Requirements
- [ ] Company, job title and the other fields stay editable in the panel exactly as they are today
- [ ] A Draft with no Requirements shows nothing rather than three empty headings
- [ ] Saving from the panel persists the Requirements as extracted
- [ ] The extension builds against the new contract and is rebuilt as part of this change
