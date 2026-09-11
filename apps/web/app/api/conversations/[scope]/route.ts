import { authenticatedRoute } from "../../../../lib/api/authenticated-route";
import { readConversationResponse } from "../../../../lib/conversations/api";

export { OPTIONS } from "../../../../lib/api/cors";

type Params = Awaited<RouteContext<"/api/conversations/[scope]">["params"]>;

export const GET = authenticatedRoute<Params>(readConversationResponse);
