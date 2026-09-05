import { sessionRoute } from "../../../../lib/api/authenticated-route";
import { revokePersonalAccessTokenResponse } from "../../../../lib/personal-access-tokens/api";

export { OPTIONS } from "../../../../lib/api/cors";

type Params = Awaited<
  RouteContext<"/api/personal-access-tokens/[id]">["params"]
>;

/**
 * Revoking is a DELETE: it is what a client asks for when it wants a token
 * gone. That the row survives with `revokedAt` set is the API's business, not
 * the caller's — the token stops working either way.
 */
export const DELETE = sessionRoute<Params>(revokePersonalAccessTokenResponse);
