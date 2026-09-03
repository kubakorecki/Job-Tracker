import { sessionRoute } from "../../../lib/api/authenticated-route";
import {
  createPersonalAccessTokenResponse,
  listPersonalAccessTokensResponse,
} from "../../../lib/personal-access-tokens/api";

export { OPTIONS } from "../../../lib/api/cors";

export const GET = sessionRoute(listPersonalAccessTokensResponse);
export const POST = sessionRoute(createPersonalAccessTokenResponse);
