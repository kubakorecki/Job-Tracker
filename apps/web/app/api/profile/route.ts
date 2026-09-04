import { authenticatedRoute } from "../../../lib/api/authenticated-route";
import {
  readProfileResponse,
  uploadProfileResponse,
} from "../../../lib/profile/api";

export { OPTIONS } from "../../../lib/api/cors";

export const GET = authenticatedRoute(readProfileResponse());
export const POST = authenticatedRoute(uploadProfileResponse());
