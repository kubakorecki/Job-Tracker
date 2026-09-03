import { authenticatedRoute } from "../../../../lib/api/authenticated-route";
import {
  deleteJobApplicationResponse,
  readJobApplicationResponse,
  updateJobApplicationResponse,
} from "../../../../lib/job-applications/api";

type Params = Awaited<RouteContext<"/api/job-applications/[id]">["params"]>;

export const GET = authenticatedRoute<Params>(readJobApplicationResponse);
export const PATCH = authenticatedRoute<Params>(updateJobApplicationResponse);
export const DELETE = authenticatedRoute<Params>(deleteJobApplicationResponse);
