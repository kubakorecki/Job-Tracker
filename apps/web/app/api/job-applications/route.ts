import { authenticatedRoute } from "../../../lib/api/authenticated-route";
import {
  createJobApplicationResponse,
  listJobApplicationsResponse,
} from "../../../lib/job-applications/api";

export { OPTIONS } from "../../../lib/api/cors";

export const GET = authenticatedRoute(listJobApplicationsResponse);
export const POST = authenticatedRoute(createJobApplicationResponse);
