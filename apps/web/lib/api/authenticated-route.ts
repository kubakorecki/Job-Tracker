import { getCurrentUser, type CurrentUser } from "../auth/current-user";
import { withCors } from "./cors";
import { errorResponse } from "./response";

/**
 * A route handler that has already been told who is asking, and — on a route
 * with a dynamic segment — which record is being addressed. Taking both as
 * arguments rather than resolving them itself is what lets a handler be called
 * directly in a test, with no session and no auth service.
 */
export type AuthenticatedHandler<Params = Record<string, never>> = (
  request: Request,
  user: CurrentUser,
  params: Params,
) => Promise<Response>;

/**
 * Wraps a handler so it only ever runs for a known user. Every `route.ts`
 * exports through this, which is the single place a 401 is decided — and,
 * since the resolver reads a Bearer Personal Access Token as readily as a
 * session cookie, the single place the extension's credential works.
 *
 * It is also where every response picks up its CORS headers, for the same
 * reason: a route added later is reachable from the extension without anyone
 * remembering to make it so. The preflight is the other half, and each
 * `route.ts` re-exports `OPTIONS` from `./cors` for it.
 *
 * `resolveUser` is substitutable so that the 401 itself can be tested; nothing
 * but a test ever passes it.
 */
export function authenticatedRoute<Params = Record<string, never>>(
  handler: AuthenticatedHandler<Params>,
  resolveUser: (request: Request) => Promise<CurrentUser | null> = getCurrentUser,
) {
  return async (
    request: Request,
    context: { params: Promise<Params> },
  ): Promise<Response> => {
    const user = await resolveUser(request);

    if (user === null) {
      return withCors(
        request,
        errorResponse(
          "Sign in, or send a Personal Access Token, to use this endpoint.",
          401,
        ),
      );
    }

    return withCors(request, await handler(request, user, await context.params));
  };
}

/**
 * Like `authenticatedRoute`, but a session cookie is the only credential that
 * will do. Issuing and revoking tokens is how a user takes control back after
 * losing a machine, so a Personal Access Token may not be used to mint another
 * or to revoke one: otherwise a stolen token would issue itself a replacement,
 * the user would revoke the token they knew about, and the thief would still be
 * inside. Revocation has to mean something.
 *
 * It is the same resolver, asked without a request — which is the whole of what
 * makes the `Authorization` header unreadable here.
 */
export function sessionRoute<Params = Record<string, never>>(
  handler: AuthenticatedHandler<Params>,
  resolveUser: () => Promise<CurrentUser | null> = getCurrentUser,
) {
  return authenticatedRoute<Params>(handler, () => resolveUser());
}
