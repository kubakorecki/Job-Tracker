import { RequirementWithCoverage } from "@repo/schema";
import { z } from "zod";

/**
 * What an Analysis looks like to a client. It lives here rather than in
 * `@repo/schema` because it is not a shared contract: the extension saves
 * Postings and has nowhere to show a verdict, and the dashboard is the only
 * surface that runs one or reads one back.
 *
 * The verdicts themselves are not in these shapes. Each one belongs to the
 * Requirement it is about and travels as `analysedCoverage` and
 * `analysedReason` on `RequirementWithCoverage`, where the precedence that may
 * hide it is applied (ADR-0004). What is here is only what belongs to the run.
 */

/**
 * One Analysis, as it is read back: when it ran, and whether it has stopped
 * describing the world.
 *
 * `stale` is derived on every read rather than stored, and is already false
 * for a Job Application the user can no longer act on — a client renders it
 * rather than deciding it, so the banner and the endpoint cannot disagree
 * about what counts (`./staleness`).
 */
export const Analysis = z.object({
  ranAt: z.iso.datetime(),
  stale: z.boolean(),
});
export type Analysis = z.infer<typeof Analysis>;

/**
 * What reading the Analysis answers with. `null` is a first-class answer
 * rather than a 404: a Job Application nobody has analysed is in the ordinary
 * state, and an endpoint that called it an error would make every client
 * handle the ordinary case in a catch block — the same arrangement
 * `ProfileOrNone` makes for a user who has not uploaded a CV.
 */
export const AnalysisOrNone = Analysis.nullable();
export type AnalysisOrNone = z.infer<typeof AnalysisOrNone>;

/**
 * What a run answers with: the Analysis, and every Requirement as it now
 * reads.
 *
 * The Requirements come back rather than being left for the caller to fetch,
 * because a run changes all of them at once and the page is showing them: the
 * alternative is a second request during which the badges are the old ones.
 * They carry the resolved Coverage, so a Requirement the user has already
 * overridden reads as the user's word with the model's underneath it, which is
 * exactly what the badge has to show.
 */
export const AnalysisResult = z.object({
  analysis: Analysis,
  requirements: z.array(RequirementWithCoverage),
});
export type AnalysisResult = z.infer<typeof AnalysisResult>;
