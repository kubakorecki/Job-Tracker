# 06: The Conversation panel

**What to build:** The drawer, on every signed-in page, showing the
Conversation for wherever the user is standing.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] An overlay drawer from the right: `paper-raised` over the page's `paper`, with a `border-line` edge and no shadow — there is no shadow anywhere in this system
- [ ] Opened from the `AppBar`, which is the one thing on every signed-in page. Not via its `action` slot: that is the page's own primary thing to do, and this belongs to every page
- [ ] Which Conversation it shows is decided by the route alone — the Job Application's on `/dashboard/job-applications/[id]`, the general one everywhere else. No switcher and no picker anywhere in the UI
- [ ] The header says which Conversation this is, so the scope is visible without being selectable
- [ ] Full-width on small viewports; an overlay rather than a pushing rail, because the board is a horizontally scrolled column layout that must not reflow on every question
- [ ] Replies stream into the last Message as they arrive
- [ ] Every model Message has a copy affordance — the cover letter is the point, and a drag-select is not a feature
- [ ] Closing and reopening, and navigating away and back, leave the Conversation intact
- [ ] With no CV on the Profile: the panel opens, says plainly that no CV is attached, links to `/settings/profile`, and still allows chatting
- [ ] A spent AI Usage allowance, an unreachable provider, and a mid-stream failure each read differently and each say what to do; a partial reply keeps its text with the failure shown against it
- [ ] Clearing asks first, and says that the Messages will not be recoverable
- [ ] The daily Model Call limit is never mentioned in any string
- [ ] Follows `docs/design-system.md` for tokens, type and voice
