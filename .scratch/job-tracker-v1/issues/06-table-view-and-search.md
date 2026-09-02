# 06: Table view and client-side search

**What to build:** The user can switch between the board and a dense table, and find a specific Job Application among many by typing.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] A table view lists Job Applications densely as an alternative to the board
- [ ] A toggle switches between board and table
- [ ] The chosen view is remembered across sessions in browser storage, not the URL
- [ ] Search matches company or job title and updates as the user types, with no debounce and no loading state
- [ ] Filtering by Status is available in both views
- [ ] Search and filtering run entirely client-side against the single cached list, so the board and the results can never disagree
- [ ] Clearing the search restores the full set
