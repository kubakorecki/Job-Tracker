import { authenticatedRoute } from "../../../../../lib/api/authenticated-route";
import {
  attachTailoredCvResponse,
  detachTailoredCvResponse,
  readTailoredCvResponse,
} from "../../../../../lib/tailored-cvs/api";

export { OPTIONS } from "../../../../../lib/api/cors";

type Params = Awaited<RouteContext<"/api/job-applications/[id]/cv">["params"]>;

export const GET = authenticatedRoute<Params>(readTailoredCvResponse());
export const POST = authenticatedRoute<Params>(attachTailoredCvResponse());
export const DELETE = authenticatedRoute<Params>(detachTailoredCvResponse());
