import { createSupabaseServerClient } from "../supabase/server";

/**
 * Who is making this request, according to the session cookie. Ticket 07 adds
 * a Bearer Personal Access Token as a second way in; every caller goes through
 * this one resolver so that stays a single change.
 */
export type CurrentUser = {
  id: string;
  email: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServerClient();

  // `getClaims` verifies the JWT rather than trusting the cookie's contents.
  const { data, error } = await supabase.auth.getClaims();
  if (error !== null || data === null) return null;

  const { sub, email } = data.claims;
  return { id: sub, email: typeof email === "string" ? email : null };
}
