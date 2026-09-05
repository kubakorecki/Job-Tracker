# Multi-tenant schema, single-tenant operation

Every table carries `user_id` and all access goes through Supabase Auth, because
the tracker may become a live service later and retrofitting tenancy onto a
single-user schema is expensive. But v1 is operated for exactly one person: there
is no self-serve sign-up (accounts are created in the Supabase dashboard) and no
Row Level Security, because Drizzle connects over `DATABASE_URL` as the database
owner and RLS policies on that path would be dead code offering false confidence.

## Consequences

Tenant isolation is enforced entirely in application code. To keep that
enforceable, every query lives in a repository module that takes `user_id` as a
non-optional argument — no route handler builds a query inline. The single
exception is the query that _establishes_ the user: authenticating a Personal
Access Token looks a row up by its hash alone, because a request carrying a
token has said nothing else about itself. It lives in the tokens repository
with the rest and returns the `user_id` every later query is then scoped by.

Turning on sign-up later means adding RLS and moving to per-request Supabase
clients, which is a real project, not a config flag.
