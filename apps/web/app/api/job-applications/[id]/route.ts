import { authenticatedRoute } from "../../../../lib/api/authenticated-route";
import { updateJobApplicationResponse } from "../../../../lib/job-applications/api";

export const PATCH = authenticatedRoute<
  Awaited<RouteContext<"/api/job-applications/[id]">["params"]>
>(updateJobApplicationResponse);
