# Two cloud Supabase projects, no local stack

Development runs against a `job-tracker-dev` Supabase project and production
against `job-tracker-prod` — both on the Free plan, which allows exactly two
active projects per organization. There is deliberately no local database: the
local Supabase stack is Docker Compose running Postgres, GoTrue, Kong, PostgREST
and more (~7GB RAM) and would have to stay healthy alongside the Next.js dev
server and Chrome, whereas a second cloud project is an environment-variable
swap. Switching environments never means running different software.

## Consequences

Free projects pause after a week of inactivity, so both the dev project and the
occasional-use production project will sometimes need an unpause click in the
dashboard before the app responds. Development requires a network connection.
The end-to-end test runs against the dev project and therefore shares its fate.

If offline development ever becomes necessary, the escape hatch is
`supabase start -x realtime,storage-api,imgproxy,edge-runtime,studio,logflare,vector`
— but this is not a supported path and nothing is built to accommodate it.
