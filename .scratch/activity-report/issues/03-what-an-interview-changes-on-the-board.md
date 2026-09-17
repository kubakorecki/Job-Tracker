# 03: What an Interview changes on the board

**What to build:** The readings that stop being guesses once meetings are recorded.

**Status:** ready-for-agent

- [ ] `silenceOf` reads Interviews: a future one means no silence at all, and a past one is what the count runs from, in place of `updatedAt`
- [ ] The comment in `silence.ts` about `updatedAt` being a stand-in goes, replaced by what now decides it
- [ ] `threadOf` draws a beat for an Interview arranged and one for an Interview held, cancelled ones marked
- [ ] The next Interview's date shows on the board card and the table row, beside where the Closing shows, per `docs/design-system.md`
- [ ] A Conversation attached to a Job Application is assembled with its Interviews; the general Conversation gets the next Interview's date in the outline (ADR-0008)
