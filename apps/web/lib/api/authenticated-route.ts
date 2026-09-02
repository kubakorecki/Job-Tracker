import { getCurrentUser, type CurrentUser } from "../auth/current-user";
import { errorResponse } from "./response";

/**
 * A route handler that has already been told who is asking. Taking the user as
 * an argument rather than resolving one itself is what lets a handler be
 * called directly in a test, with no session and no auth service.
 */
export type AuthenticatedHandler = (
  request: Request,
  user: CurrentUser,
) => Promise<Response>;

/**
 * Wraps a handler so it only ever runs for a known user. Every `route.ts`
 * exports through this, which is the single place a 401 is decided — and, once
 * ticket 07 teaches the resolver about Bearer tokens, the single place the
 * extension's credential starts working.
 *
 * `resolveUser` is substitutable so that the 401 itself can be tested; nothing
 * but a test ever passes it.
 */
export function authenticatedRoute(
  handler: AuthenticatedHandler,
  resolveUser: () => Promise<CurrentUser | null> = getCurrentUser,
) {
  return async (request: Request): Promise<Response> => {
    const user = await resolveUser();

    if (user === null) {
      return errorResponse("Sign in to use this endpoint.", 401);
    }

    return handler(request, user);
  };
}
