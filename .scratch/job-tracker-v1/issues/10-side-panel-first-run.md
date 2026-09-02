# 10: Side panel first run and recent Job Applications

**What to build:** Opening the side panel for the first time asks for a token and where the API lives; afterwards it shows the user's most recent Job Applications, so the panel is useful even on a page that isn't a Posting.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] The toolbar icon opens the side panel directly, with no popup
- [ ] With no token stored, the panel shows a setup form for the Personal Access Token and the API base URL
- [ ] Those settings are stored locally and survive browser restarts
- [ ] The default API base URL comes from a build-time value, so development builds point locally and production builds point at the deployed API
- [ ] The settings field overrides that default
- [ ] The panel is a fixed shell: a header linking to the dashboard, a primary action area, and the recent list below — not a sequence of replacing screens
- [ ] With a token stored, the panel lists the user's five most recent Job Applications
- [ ] An invalid or revoked token produces a clear message and a route back to the setup form
