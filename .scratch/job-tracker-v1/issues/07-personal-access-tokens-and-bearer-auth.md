# 07: Generate a Personal Access Token and call the API with it

**What to build:** The user can issue a named credential in the dashboard and use it to reach their own data from outside the browser session — which is how the extension will authenticate. Revoking it takes effect immediately.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] A Personal Access Tokens table stores a name, a SHA-256 hash of the token, creation time, last-used time and a nullable revocation time
- [ ] The raw token value is shown exactly once on creation, with a copy button, and is never recoverable afterwards
- [ ] Each token is named, so one machine's token is distinguishable from another's
- [ ] A settings page lists tokens with their name, creation time and last-used time, and never exposes the hash
- [ ] A token can be revoked; revocation is soft, so the row survives as a trace
- [ ] The current-user resolver accepts a Bearer token as an alternative to the session cookie
- [ ] A revoked token is rejected immediately on the next request
- [ ] A successful Bearer request updates that token's last-used time
- [ ] Every endpoint carries CORS headers from one shared layer, with preflight handled, the authorization header permitted, and credentials off
- [ ] The allowlist covers the extension origin and the local development origin; other origins are refused
- [ ] Tests authenticate with a Bearer token rather than a session, proving the whole API is reachable without the auth service
