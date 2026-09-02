import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { routeAccessFor } from "./lib/auth/route-access";
import { supabaseEnv } from "./lib/env";

/**
 * Runs before every page render. It does two things: refreshes the Supabase
 * session so an expired access token is renewed while the response can still
 * carry the new cookies, and turns the route rules into an actual redirect.
 *
 * The guard lives here rather than in each page so that a page added later is
 * private without anyone remembering to make it so.
 */
export default async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  const { url, anonKey } = supabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [header, value] of Object.entries(headers)) {
          response.headers.set(header, value);
        }
      },
    },
  });

  // Must be awaited before the response is returned: a refresh that lands
  // afterwards has nowhere to write its cookies and is silently lost.
  const { data } = await supabase.auth.getClaims();

  const access = routeAccessFor({
    pathname: request.nextUrl.pathname,
    signedIn: data !== null,
  });

  if (access.kind === "allow") return response;

  const destination = request.nextUrl.clone();
  destination.pathname = access.to;
  destination.search = "";

  const redirect = NextResponse.redirect(destination);
  // Carry over anything the refresh just wrote, or the next request repeats it.
  for (const cookie of response.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

export const config = {
  matcher: [
    /*
     * Every path except Next's own assets and static files — the guard has no
     * opinion about an image, and running it there costs a session lookup.
     *
     * `/api` is excluded too: those routes answer the extension, which
     * authenticates with a Bearer Personal Access Token and no cookie
     * (ticket 07). Redirecting them would turn a 401 into a 307 at an HTML
     * page, and the session lookup would be wasted on every preflight.
     */
    "/((?!api(?:/|$)|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
