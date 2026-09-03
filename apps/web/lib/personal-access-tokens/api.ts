import { jsonBody } from "../api/request";
import { errorResponse } from "../api/response";
import type { CurrentUser } from "../auth/current-user";
import { describeIssues } from "../zod-issues";
import {
  CreatePersonalAccessToken,
  PersonalAccessToken,
  type IssuedPersonalAccessToken,
} from "./contract";
import {
  createPersonalAccessToken,
  listPersonalAccessTokens,
  revokePersonalAccessToken,
} from "./repository";
import { generatePersonalAccessToken, hashPersonalAccessToken } from "./token";

/**
 * The Personal Access Token endpoints, as plain request-to-response functions,
 * the way the Job Applications endpoints are — so they can be exercised with
 * no session and no auth service, which is the whole reason the API is the
 * only backend seam.
 */

/** `GET /api/personal-access-tokens`. Never the raw value, never the hash. */
export async function listPersonalAccessTokensResponse(
  _request: Request,
  user: CurrentUser,
): Promise<Response> {
  return Response.json(await listPersonalAccessTokens(user.id));
}

/**
 * `POST /api/personal-access-tokens`, wanting a name. The response is the only
 * time the raw token exists outside the user's clipboard: the database keeps
 * its hash, so nothing here — or anywhere later — can show it again.
 */
export async function createPersonalAccessTokenResponse(
  request: Request,
  user: CurrentUser,
): Promise<Response> {
  const read = await jsonBody(request);
  if ("refusal" in read) return read.refusal;

  const input = CreatePersonalAccessToken.safeParse(read.body);
  if (!input.success) {
    return errorResponse(
      "That Personal Access Token is not valid.",
      400,
      describeIssues(input.error),
    );
  }

  const token = generatePersonalAccessToken();
  const created = await createPersonalAccessToken(user.id, {
    name: input.data.name,
    tokenHash: hashPersonalAccessToken(token),
  });

  const issued: IssuedPersonalAccessToken = { ...created, token };
  return Response.json(issued, { status: 201 });
}

/**
 * `DELETE /api/personal-access-tokens/:id`. The token stops working at once;
 * the row stays, carrying when it was issued, when it was last used and when
 * it was revoked — so a token that had to be revoked leaves a trace rather
 * than taking the evidence with it.
 */
export async function revokePersonalAccessTokenResponse(
  _request: Request,
  user: CurrentUser,
  { id }: { id: string },
): Promise<Response> {
  if (!isPersonalAccessTokenId(id)) return notFound();

  const revoked = await revokePersonalAccessToken(user.id, id);
  return revoked === null ? notFound() : Response.json(revoked);
}

/**
 * Whether the address could name a Personal Access Token at all, so an id that
 * could never be one is answered the same way as one that simply isn't the
 * caller's, rather than reaching Postgres and coming back as a cast error.
 */
function isPersonalAccessTokenId(id: string): boolean {
  return PersonalAccessToken.shape.id.safeParse(id).success;
}

/**
 * Somebody else's token is indistinguishable from one that does not exist, and
 * from one already revoked.
 */
function notFound(): Response {
  return errorResponse("No such Personal Access Token.", 404);
}
