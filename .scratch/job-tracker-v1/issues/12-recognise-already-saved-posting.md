# 12: Recognise an already-saved Posting

**What to build:** Revisiting a Posting the user already saved shows them the existing Job Application and its Status instead of extracting again — even when the URL arrives with different tracking parameters. Near-duplicates at the same company are hinted at, never merged automatically.

**Blocked by:** 11

**Status:** ready-for-agent

- [ ] Job Applications carry a stored normalized URL alongside the original, which is kept intact for display and for opening the Posting
- [ ] A partial unique index per user prevents two Job Applications sharing a normalized URL, and tolerates Job Applications with no URL
- [ ] The list endpoint accepts a URL lookup, normalizing the input before matching
- [ ] The panel performs that lookup on open and, on a hit, shows the existing Job Application's company, job title and Status with no extraction call
- [ ] Status can be changed directly from that view
- [ ] There is no re-extract path for an already-saved Posting; editing happens in the dashboard
- [ ] A Posting saved via a tracking-laden URL is recognised when reached later by a clean URL, and vice versa
- [ ] Attempting to save a duplicate Posting is rejected rather than creating a second Job Application
- [ ] Saving a role at a company where a similar job title already exists shows a non-blocking hint; the save still proceeds if the user continues (ADR-0002)
- [ ] The same role posted on two different sites remains two Job Applications and is never merged automatically
- [ ] Normalization behaviour is proven through the API — save with tracking parameters, look up by a different parameterisation, expect a hit — rather than by testing the normalizer directly
