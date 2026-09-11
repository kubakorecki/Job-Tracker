import { authenticatedRoute } from "../../../../../lib/api/authenticated-route";
import {
  clearConversationResponse,
  sendMessageResponse,
} from "../../../../../lib/conversations/api";

export { OPTIONS } from "../../../../../lib/api/cors";

type Params = Awaited<
  RouteContext<"/api/conversations/[scope]/messages">["params"]
>;

export const POST = authenticatedRoute<Params>(sendMessageResponse());
export const DELETE = authenticatedRoute<Params>(clearConversationResponse);
