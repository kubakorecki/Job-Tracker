import { authenticatedRoute } from "../../../lib/api/authenticated-route";
import { extractJobResponse } from "../../../lib/extraction/api";

export { OPTIONS } from "../../../lib/api/cors";

export const POST = authenticatedRoute(extractJobResponse());
