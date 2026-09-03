import { authenticatedRoute } from "../../../lib/api/authenticated-route";
import { extractJobRoute } from "../../../lib/extraction/api";

export { OPTIONS } from "../../../lib/api/cors";

export const POST = authenticatedRoute(extractJobRoute());
