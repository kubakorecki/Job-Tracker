# 11: Save this job — extract, review, save

**What to build:** On a Posting, one click reads the page, produces a Draft, and shows it as an editable form. The user corrects anything wrong and saves, and it lands in the same place the dashboard reads from. If extraction finds nothing, the same form opens empty rather than the flow breaking.

**Blocked by:** 09, 10

**Status:** ready-for-agent

- [ ] A "Save this job" button is visible whenever a token is configured and the current tab isn't already saved
- [ ] Clicking it reads the active tab's visible text on demand, using the already-granted permissions and no persistent content script
- [ ] Extraction never runs on panel open, only on an explicit click, so opening the panel on a non-job page costs nothing
- [ ] The returned Draft pre-fills an editable review form; nothing is saved until the user confirms
- [ ] The Posting's URL is attached to the saved Job Application
- [ ] Saving creates the Job Application through the same endpoint the dashboard uses, and it appears on the dashboard
- [ ] A `no_job_found` response opens the review form empty with a clear explanation, rather than showing an error
- [ ] A `provider_error` response says the provider is unavailable and still offers manual entry
- [ ] A `rate_limited` response says the daily limit is reached and that waiting is the remedy
- [ ] "Add manually" is available as a secondary action in every state, opening the same form with empty fields
- [ ] Cancelling the review form returns to the panel's default view
