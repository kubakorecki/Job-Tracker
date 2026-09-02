# 02: Sign in and reach an authenticated dashboard

**What to build:** The user can sign in with email and password and land on their own dashboard; signed out, they can't reach it at all. This proves the authentication half of the stack end to end, before any table exists.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Two Supabase Free-plan projects exist, dev and prod, per ADR-0003
- [ ] Environment variables are documented and in place for both, including separate pooled and direct database URLs
- [ ] The account is created by hand in the dashboard; there is no self-serve sign-up page (ADR-0001)
- [ ] A sign-in page accepts email and password and reports bad credentials clearly
- [ ] A signed-in session survives a browser restart
- [ ] Visiting the dashboard while signed out redirects to sign-in rather than rendering an empty board
- [ ] Signing out ends the session and returns the user to sign-in
