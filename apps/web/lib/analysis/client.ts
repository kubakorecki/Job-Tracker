import { send } from "../api/client";
import type { AnalysisOrNone, AnalysisResult } from "./contract";

/**
 * The Analysis endpoints, as the Job Application page addresses them.
 *
 * Two requests that look alike and cost nothing alike: one spends a model call
 * from the user's daily allowance and one is a read. They are named so that
 * calling the expensive one is never a slip of the finger — `runAnalysis` is
 * the only thing in the dashboard that spends anything, and it is only ever
 * reached from a button the user pressed.
 */

const analysisOf = (jobApplicationId: string) =>
  `/api/job-applications/${jobApplicationId}/analysis`;

/**
 * Asks the model to read this Job Application's Requirements against the
 * Profile's prose, and answers with the run and every Requirement as it now
 * reads.
 *
 * The Requirements come back with it, so the badges change with the banner
 * rather than a request later — and they carry the resolved Coverage, so one
 * the user has already overridden still reads as the user's word.
 *
 * It refuses in four distinguishable ways, each in the endpoint's own
 * sentence: nothing to analyse, no CV to analyse against, a provider that
 * could not be reached, and a spent daily allowance. None of them is worth
 * paraphrasing at the button.
 */
export async function runAnalysis(
  jobApplicationId: string,
): Promise<AnalysisResult> {
  return send(analysisOf(jobApplicationId), { method: "POST" });
}

/**
 * When the last Analysis ran and whether it still stands, or `null` where none
 * has — an ordinary answer rather than a failure, as the endpoint gives it.
 *
 * `fetch` rather than `get`, as the other client modules name theirs: this
 * feature has a `getAnalysis` of its own in the repository, and the two answer
 * to different halves of the app.
 *
 * Staleness is derived on every read, so this is how a page that has just
 * changed something underneath an Analysis — the Requirements it read, or the
 * Status that decides whether staleness is worth mentioning at all — learns
 * what the endpoint now makes of it, without deciding any of it itself.
 */
export async function fetchAnalysis(
  jobApplicationId: string,
): Promise<AnalysisOrNone> {
  return send(analysisOf(jobApplicationId));
}
