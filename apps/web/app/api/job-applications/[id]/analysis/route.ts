import { authenticatedRoute } from "../../../../../lib/api/authenticated-route";
import {
  readAnalysisResponse,
  runAnalysisResponse,
} from "../../../../../lib/analysis/api";

export { OPTIONS } from "../../../../../lib/api/cors";

type Params = Awaited<
  RouteContext<"/api/job-applications/[id]/analysis">["params"]
>;

export const POST = authenticatedRoute<Params>(runAnalysisResponse());
export const GET = authenticatedRoute<Params>(readAnalysisResponse);
