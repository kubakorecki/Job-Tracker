import { authenticatePersonalAccessToken } from "../personal-access-tokens/repository";
import {
  bearerToken,
  hashPersonalAccessToken,
} from "../personal-access-tokens/token";
import { createSupabaseServerClient } from "../supabase/server";

/**
 * Who is making this request. Two credentials answer that question: the
 * Supabase session cookie a browser carries, and a Bearer Personal Access
 * Token, which is how the extension reaches the API from an origin that can
 * hold no cookie of ours.
 *
 * Every caller goes through this one resolver, so the two ways in cannot come
 * to disagree about what a user is — and a request with no request object at
 * all (a page rendering on the server) simply has no Bearer token to offer.
 */
export type CurrentUser = {
  id: string;
  /** Null for a token-authenticated request: a token names an id, not a person. */
  email: string | null;
};

export async function getCurrentUser(
  request?: Request,
): Promise<CurrentUser | null> {
  const token = request === undefined ? null : bearerToken(request);

  // A request that presents a token is answered on the token alone. Falling
  // back to the cookie would let a revoked token keep working in the one
  // browser that still has a session, which is exactly what revocation is for.
  if (token !== null) return userForPersonalAccessToken(token);

  return userForSession();
}

/**
 * The user a token belongs to, if it was ever issued and has not been revoked.
 * The lookup is by hash — the raw value is not stored — and it stamps the
 * token's last-used time as it goes.
 */
async function userForPersonalAccessToken(
  token: string,
): Promise<CurrentUser | null> {
  const userId = await authenticatePersonalAccessToken(
    hashPersonalAccessToken(token),
  );

  return userId === null ? null : { id: userId, email: null };
}

async function userForSession(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServerClient();

  // `getClaims` verifies the JWT rather than trusting the cookie's contents.
  const { data, error } = await supabase.auth.getClaims();
  if (error !== null || data === null) return null;

  const { sub, email } = data.claims;
  return { id: sub, email: typeof email === "string" ? email : null };
}
