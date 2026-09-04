# 14: Loading, empty and error states

**What to build:** Across both surfaces, the user can always tell "nothing here yet" apart from "still loading" apart from "something broke" — and every broken case says what to do next.

**Blocked by:** 05, 06, 12

**Status:** ready-for-agent

- [x] A user with no Job Applications sees an empty state inviting them to add one, not a blank board
- [x] Board, table, detail view and settings each show a loading state on first fetch
- [x] A failed fetch shows an error with a way to retry, rather than an empty result
- [x] The side panel shows loading state while extracting, and the button cannot be clicked twice
- [x] The side panel's empty recent-jobs list reads as empty rather than broken
- [x] Authentication failures in the panel route to the setup form
- [x] A search that matches nothing says so, distinctly from having no Job Applications at all
