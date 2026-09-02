# 09: Extract a Draft from page text

**What to build:** Given a URL and the visible text of a page, the API returns a Draft with company, job title, location, salary and keywords filled in — or says clearly why it couldn't, so the caller can fall back to manual entry instead of breaking.

**Blocked by:** 01, 07

**Status:** ready-for-agent

- [ ] An extraction endpoint accepts a URL and page text and returns the extraction response union
- [ ] The provider call sits behind a single extraction function, which is both the future provider swap point and the substitution point for tests
- [ ] Page text is truncated to roughly thirty thousand characters from the front of the document before being sent
- [ ] The response schema sent to the provider is flat, since only a subset of JSON Schema is supported and nested schemas can be rejected
- [ ] A successful extraction returns a Draft; a bare Draft is never returned on its own
- [ ] When company and job title both come back empty, the response is `no_job_found` with HTTP 200
- [ ] A provider failure, including a quota error, returns `provider_error` with HTTP 200 — there is no silent fallback to a cheaper model
- [ ] A per-user daily counter limits extractions to one hundred, upserted within the same request
- [ ] Exceeding the limit returns `rate_limited` with HTTP 429
- [ ] Tests substitute a fake provider covering a good Draft, an empty result and an error, and require no API key or network
- [ ] The model identifier lives in one exported constant
