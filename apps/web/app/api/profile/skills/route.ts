import { authenticatedRoute } from "../../../../lib/api/authenticated-route";
import { setProfileSkillsResponse } from "../../../../lib/profile/api";

export { OPTIONS } from "../../../../lib/api/cors";

export const PUT = authenticatedRoute(setProfileSkillsResponse);
