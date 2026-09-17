# 02: Interviews on a Job Application

**What to build:** The list of meetings itself — contract, table, and the detail view that edits it.

**Status:** ready-for-agent

- [ ] An `interviews` table: id, `user_id`, `job_application_id` (cascading), the day held, an optional time, the stage as the user words it, an optional meeting link, an optional place, optional notes, the day it was arranged, and a cancelled marker
- [ ] The day held is a `date` read as a string, for ADR-0007's reason; the time is its own optional column rather than an invented instant
- [ ] The day arranged defaults to today and is editable — an invitation that arrived last week is not news from today
- [ ] `Interview` in the shared contract, and a Job Application reads its Interviews in date order
- [ ] The detail view adds, edits, cancels and deletes them
- [ ] Adding one when the Status is not `interviewing` asks whether to move it, and moves it only on a yes (ADR-0011)
