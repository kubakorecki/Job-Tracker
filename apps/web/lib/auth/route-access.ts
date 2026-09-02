/**
 * Where the sign-in flow lives, and where a signed-in user belongs. Both the
 * proxy and the sign-in and sign-out actions redirect to these, so the two
 * halves of the flow cannot disagree about the destination.
 */
export const SIGN_IN_PATH = "/sign-in";
export const DASHBOARD_PATH = "/dashboard";

/**
 * The routes reachable without a session. Everything else is private —
 * listing the exceptions rather than the protected routes means a page added
 * later is guarded by default rather than by remembering to add it here.
 */
const PUBLIC_PATHS = new Set<string>([SIGN_IN_PATH]);

/**
 * The only two places the guard ever sends anyone. Narrower than `string` so
 * a redirect to a path that is neither is a type error rather than a loop
 * discovered in a browser.
 */
export type GuardedPath = typeof SIGN_IN_PATH | typeof DASHBOARD_PATH;

export type RouteAccess =
  { kind: "allow" } | { kind: "redirect"; to: GuardedPath };

/**
 * Decides what a request to `pathname` may do given whether it carries a
 * session. Pure, so the redirect rules can be read and tested without a
 * request, a response or an auth service.
 */
export function routeAccessFor({
  pathname,
  signedIn,
}: {
  pathname: string;
  signedIn: boolean;
}): RouteAccess {
  const isPublic = PUBLIC_PATHS.has(stripTrailingSlash(pathname));

  if (signedIn) {
    return isPublic
      ? { kind: "redirect", to: DASHBOARD_PATH }
      : { kind: "allow" };
  }

  return isPublic ? { kind: "allow" } : { kind: "redirect", to: SIGN_IN_PATH };
}

/** `/sign-in/` and `/sign-in` are the same route; `/` must stay `/`. */
function stripTrailingSlash(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
}
