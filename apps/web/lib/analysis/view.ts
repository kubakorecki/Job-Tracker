import type { JobStatus } from "@repo/schema";
import { requirementsChangedAt } from "../job-applications/repository";
import { profileChangedAt } from "../profile/repository";
import type { AnalysisOrNone } from "./contract";
import { getAnalysis } from "./repository";
import { isStale } from "./staleness";

/**
 * An Analysis as anything outside this module sees one: the stamp of when it
 * ran, and whether what it read has moved since.
 *
 * It sits apart from `./api` because reading one is more than a query — a
 * stamp, the two stamps it is judged against, and the rule that compares them
 * — and because the surface that shows it renders on the server, where an HTTP
 * hop to this app's own API would buy nothing. The same arrangement
 * `profile/view.ts` makes, for the same reason.
 */

/** The part of a Job Application an Analysis is read about. */
export type AnalysedJobApplication = { id: string; status: JobStatus };

/**
 * The Analysis of one Job Application, or `null` where none has run — and for
 * a stranger's, for the reason `getAnalysis` gives.
 *
 * The two stamps staleness is derived from are read only once there is
 * something to compare them against: a Job Application nobody has analysed
 * cannot be stale, and asking would be two queries to reach a conclusion the
 * first one already reached.
 */
export async function readAnalysis(
  userId: string,
  jobApplication: AnalysedJobApplication,
): Promise<AnalysisOrNone> {
  const analysis = await getAnalysis(userId, jobApplication.id);
  if (analysis === null) return null;

  const [profileAt, requirementsAt] = await Promise.all([
    profileChangedAt(userId),
    requirementsChangedAt(userId, jobApplication.id),
  ]);

  return {
    ranAt: analysis.ranAt.toISOString(),
    stale: isStale({
      ranAt: analysis.ranAt,
      profileChangedAt: profileAt,
      requirementsChangedAt: requirementsAt,
      status: jobApplication.status,
    }),
  };
}
