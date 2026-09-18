import { authenticatedRoute } from "../../../../../lib/api/authenticated-route";
import { addInterviewResponse } from "../../../../../lib/interviews/api";

export { OPTIONS } from "../../../../../lib/api/cors";

type Params = Awaited<
  RouteContext<"/api/job-applications/[id]/interviews">["params"]
>;

export const POST = authenticatedRoute<Params>(addInterviewResponse);
