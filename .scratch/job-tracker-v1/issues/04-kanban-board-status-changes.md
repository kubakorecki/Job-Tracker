# 04: Kanban board with drag-and-drop Status changes

**What to build:** The user sees their pipeline as columns and moves a Job Application between them by dragging. The card moves immediately, and snaps back with an explanation if the change didn't save.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Job Applications appear as cards in columns grouped by Status, using the shared Status badge component
- [ ] Cards show company, job title, applied date and Status
- [ ] Dragging a card to another column changes that Job Application's Status
- [ ] Status changes go through the general update endpoint; there is no dedicated status endpoint
- [ ] Moving a Job Application to `applied` sets its applied date when that date is currently unset
- [ ] Moving a Job Application backwards, or to `rejected` or `withdrawn`, never clears the applied date
- [ ] The whole board is fetched under a single query key and grouped client-side
- [ ] A move renders immediately, before the request completes
- [ ] A failed move restores the board to its previous state and shows a message offering a retry
- [ ] Retrying from that message reattempts the same change
- [ ] A Status change persists across a page reload
