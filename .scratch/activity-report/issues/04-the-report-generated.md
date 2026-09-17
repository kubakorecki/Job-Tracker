# 04: The report, generated

**What to build:** The pure function from a month to a proposed report, and nothing about the page.

**Status:** ready-for-agent

- [ ] A month selector defaulting to the previous month; boundaries in the browser's zone
- [ ] Rows: every Job Application with a Status Change, an `applied_at`, or an Interview arranged or held in the month. Never a bookmark
- [ ] Column 2 from `applied_at`, Interviews held, and a Status Change to `withdrawn`; `applied` is read from `applied_at` and its Status Change ignored (ADR-0010)
- [ ] Column 3 from the day Interviews were arranged and from Status Changes to `offer` and `rejected`; `Brak odpowiedzi` where the month brought nothing back
- [ ] Column 1 from company, job title, location, `source` and the Posting's link
- [ ] Rows in the order of the month's first event
- [ ] Today as an argument, never a call to the clock, so every case is testable
