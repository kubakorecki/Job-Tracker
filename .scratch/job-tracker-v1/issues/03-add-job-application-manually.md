# 03: Add a Job Application manually and see it listed

**What to build:** The user can record a job by hand — with or without a Posting URL — and see it appear in their list. This is the first path that touches the database, and it stands up the test harness every later ticket will use.

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [ ] A Job Applications table exists, mirroring the shared contract, with no foreign key into the auth schema
- [ ] Every query goes through a repository module that takes the user identifier as a non-optional argument; no request handler builds a query inline (ADR-0001)
- [ ] A current-user resolver reads the session cookie and rejects unauthenticated requests
- [ ] A user can create a Job Application supplying only company and job title
- [ ] A user can create a Job Application with no URL, so referrals and recruiter emails are recordable
- [ ] A user can list their own Job Applications, optionally filtered by Status
- [ ] A user never receives another user's Job Applications from any endpoint
- [ ] An add form validates against the shared contract before submitting
- [ ] Saved Job Applications render in a list showing company, job title, applied date and Status
- [ ] A test runner is configured, running serially against the dev project with a dedicated test user distinct from the human's account
- [ ] Tests create the data they need and remove it afterwards; none assume an empty database
- [ ] A test proves a second user's Job Applications are never returned
