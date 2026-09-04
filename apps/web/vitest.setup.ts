import { loadLocalEnv } from "./lib/load-env";

// The API tests talk to the dev Supabase project, and only Next.js reads
// `.env.local` on its own.
loadLocalEnv();
