# 08: Deploy to Vercel and pin the extension ID

**What to build:** The API runs live against the production project, and the extension has a stable identity the CORS allowlist can trust. Deploying now means connection and CORS problems surface against a handful of endpoints rather than a finished app.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] The web app is deployed to Vercel against the prod Supabase project
- [ ] Production environment variables are set, with the pooled connection used at runtime and prepared statements disabled
- [ ] Migrations have been applied to the prod project using the direct connection
- [ ] The extension's ID is pinned in its manifest so it survives unpacked reloads
- [ ] Both the pinned extension origin and the local development origin are in the deployed allowlist
- [ ] A Bearer-authenticated request from the extension origin succeeds against production, including its preflight
- [ ] Signing in and listing Job Applications works against the deployed app
