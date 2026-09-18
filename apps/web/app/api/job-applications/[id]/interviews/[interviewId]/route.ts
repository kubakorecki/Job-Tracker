import { authenticatedRoute } from "../../../../../../lib/api/authenticated-route";
import {
  deleteInterviewResponse,
  updateInterviewResponse,
} from "../../../../../../lib/interviews/api";

export { OPTIONS } from "../../../../../../lib/api/cors";

type Params = Awaited<
  RouteContext<"/api/job-applications/[id]/interviews/[interviewId]">["params"]
>;

export const PATCH = authenticatedRoute<Params>(updateInterviewResponse);
export const DELETE = authenticatedRoute<Params>(deleteInterviewResponse);
