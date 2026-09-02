# A Posting is identified by its normalized URL

Two saves of the same job must not become two Job Applications, so
`(user_id, job_url_normalized)` carries a unique index and the extension checks
it before extracting. The normalized form is stored in its own column — host
lowercased, fragment dropped, tracking parameters (`utm_*`, `ref*`,
`trackingId`, `gh_src`) stripped, remaining parameters sorted — because raw job
URLs from LinkedIn and job boards carry per-visit tracking noise that would
defeat a unique index on the raw string. The original `job_url` is kept intact
for display and for opening the posting.

## Consequences

The same job advertised on both a job board and the company's careers page has
two Postings and will produce two Job Applications. We deliberately do not merge
these automatically: fuzzy matching on company plus title produces false merges
at companies that post twenty near-identical roles, and a wrong merge silently
destroys a record. Instead the extension shows a non-blocking "you already have
an application at this company with a similar title" hint and the user decides.

The normalization function is shared code, not a database expression: the
extension normalizes before its lookup and the API normalizes before its write,
and the two must agree exactly or the check passes while the insert conflicts.
