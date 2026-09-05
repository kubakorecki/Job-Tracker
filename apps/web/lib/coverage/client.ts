import type { Coverage, RequirementWithCoverage } from "@repo/schema";
import { send } from "../api/client";

/**
 * The Coverage endpoints, as the browser addresses them. Setting the user's
 * own word about one Requirement and taking it back are two requests, because
 * they are two things to mean — and each answers with the Requirement as it
 * now reads, so the caller learns what a cleared override fell back to without
 * asking again.
 */

const coverageOf = (jobApplicationId: string, requirementId: string) =>
  `/api/job-applications/${jobApplicationId}/requirements/${requirementId}/coverage`;

export async function putCoverageOverride(
  jobApplicationId: string,
  requirementId: string,
  coverage: Coverage,
): Promise<RequirementWithCoverage> {
  return send(coverageOf(jobApplicationId, requirementId), {
    method: "PUT",
    body: { coverage },
  });
}

export async function deleteCoverageOverride(
  jobApplicationId: string,
  requirementId: string,
): Promise<RequirementWithCoverage> {
  return send(coverageOf(jobApplicationId, requirementId), {
    method: "DELETE",
  });
}
