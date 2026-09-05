import { RequirementWithCoverage, SetCoverageOverride } from "@repo/schema";
import { jsonBody } from "../api/request";
import { errorResponse } from "../api/response";
import type { CurrentUser } from "../auth/current-user";
import { isJobApplicationId } from "../job-applications/api";
import { describeIssues } from "../zod-issues";
import { setOverriddenCoverage } from "./repository";

/**
 * The Coverage endpoints: what the user says of one Requirement, over and
 * above what the tracker read.
 *
 * Its own module rather than another pair of handlers on the Job Application,
 * for the reason the Analysis will be one too — everything about Coverage that
 * a client can ask for lives here, and a future entitlement check has one door
 * to sit behind rather than three.
 *
 * The address names the Job Application as well as the Requirement, because an
 * override is a decision about this application rather than about the skill:
 * the same skill asked for by two Postings is two Requirements and two
 * decisions, and the path says so.
 */

/** Which Requirement, on which Job Application, is being spoken about. */
export type CoverageParams = { id: string; requirementId: string };

/**
 * `PUT /api/job-applications/:id/requirements/:requirementId/coverage`,
 * carrying the Coverage the user says this Requirement has.
 *
 * A put rather than a patch: there is one value here and stating it replaces
 * whatever the user said before, including nothing at all. It answers with the
 * Requirement as it now reads, so the caller sees both the verdict and the
 * readings it beat without asking again.
 */
export async function setCoverageOverrideResponse(
  request: Request,
  user: CurrentUser,
  params: CoverageParams,
): Promise<Response> {
  if (!addressesARequirement(params)) return notFound();

  const read = await jsonBody(request);
  if ("refusal" in read) return read.refusal;

  const stated = SetCoverageOverride.safeParse(read.body);
  if (!stated.success) {
    return errorResponse(
      "That is not a Coverage.",
      400,
      describeIssues(stated.error),
    );
  }

  return requirementResponse(user, params, stated.data.coverage);
}

/**
 * `DELETE` on the same address: the user takes their word back, and the
 * Requirement falls to whatever the Analysis or the automatic comparison said
 * underneath it — or to nothing read at all, where neither has spoken.
 *
 * It answers with the Requirement rather than 204, because what a cleared
 * override falls back to is the whole point of clearing it and the caller
 * would otherwise have to go and look.
 *
 * Clearing an override that was never set is not an error: the user asked for
 * a state and that is the state they get.
 */
export async function clearCoverageOverrideResponse(
  _request: Request,
  user: CurrentUser,
  params: CoverageParams,
): Promise<Response> {
  if (!addressesARequirement(params)) return notFound();

  return requirementResponse(user, params, null);
}

/**
 * The write both endpoints make, answered with the Requirement it changed — or
 * with the one refusal they both give a stranger.
 */
async function requirementResponse(
  user: CurrentUser,
  { id, requirementId }: CoverageParams,
  coverage: SetCoverageOverride["coverage"] | null,
): Promise<Response> {
  const overridden = await setOverriddenCoverage(
    user.id,
    id,
    requirementId,
    coverage,
  );

  return overridden === null ? notFound() : Response.json(overridden);
}

/**
 * Whether the address could name one of this user's Requirements at all. An id
 * that could never be one is turned away here rather than reaching Postgres as
 * a cast error, exactly as the Job Application endpoints turn one away.
 */
function addressesARequirement({ id, requirementId }: CoverageParams): boolean {
  return (
    isJobApplicationId(id) &&
    RequirementWithCoverage.shape.id.safeParse(requirementId).success
  );
}

/**
 * Somebody else's Requirement, one on another Job Application, and one that
 * does not exist are all the same answer, so that the API never confirms a
 * stranger's row is real.
 */
function notFound(): Response {
  return errorResponse("No such Requirement.", 404);
}
