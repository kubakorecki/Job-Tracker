import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "../env";

/**
 * A Supabase client bound to the current request's cookies. Create one per
 * request and never share it — the session it reads belongs to that request.
 *
 * `@supabase/ssr` writes its auth cookies with a 400-day `maxAge`, so the
 * session is stored on disk rather than for the life of the window and
 * survives a browser restart.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components get a read-only cookie store. Dropping the write
          // is safe: the proxy runs before every render and refreshes the
          // session there, where the response can still be modified.
        }
      },
    },
  });
}
