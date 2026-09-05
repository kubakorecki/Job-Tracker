import { authenticatedRoute } from "../../../../../../../lib/api/authenticated-route";
import {
  clearCoverageOverrideResponse,
  setCoverageOverrideResponse,
} from "../../../../../../../lib/coverage/api";

export { OPTIONS } from "../../../../../../../lib/api/cors";

type Params = Awaited<
  RouteContext<"/api/job-applications/[id]/requirements/[requirementId]/coverage">["params"]
>;

export const PUT = authenticatedRoute<Params>(setCoverageOverrideResponse);
export const DELETE = authenticatedRoute<Params>(clearCoverageOverrideResponse);
