# 01: Reshape the shared contract

**What to build:** The shared contract package reaches its final v1 shape before any database work, so that everything built afterwards mirrors a contract that won't move. Nothing changes for a user; this is the prefactor that makes every later ticket's change easy.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A Job Application's URL is nullable, so a Job Application can exist with no Posting
- [ ] Creating a Job Application requires only company and job title; every other field is optional
- [ ] An omitted Status defaults to `bookmarked` and omitted nullable fields default to null, decided in one place
- [ ] An extraction response type exists as a discriminated union: a success variant carrying a Draft, and a failure variant carrying one of `no_job_found`, `provider_error`, `rate_limited`
- [ ] A URL normalizer is exported from the shared contract package: host lowercased, fragment dropped, tracking parameters stripped, remaining parameters sorted
- [ ] The normalizer lives in the shared contract package rather than a new package, because both apps must produce byte-identical output (ADR-0002)
- [ ] Both apps still build, lint and type-check cleanly from the repo root
