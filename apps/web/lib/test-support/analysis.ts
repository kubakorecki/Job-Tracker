import type { Coverage } from "@repo/schema";
import { recordAnalysis } from "../analysis/repository";
import type { CurrentUser } from "../auth/current-user";

/**
 * What an Analysis leaves behind, for the tests that are about something else
 * — an override's precedence, a badge's wording — and only need one
 * Requirement to have been read by the model.
 *
 * It is the Analysis's own write, so what a test stands on is what the
 * endpoint does rather than a second copy of it: the verdicts and the stamp
 * land together, and the override is a column neither of them touches, which
 * is the whole reason a re-run cannot overwrite the user's word (ADR-0004).
 * What it skips is the model call and the budget, which is exactly the part
 * those tests are not about; `lib/analysis/api.test.ts` is where the run
 * itself is exercised.
 */
export async function giveAnalysedCoverage(
  user: CurrentUser,
  jobApplicationId: string,
  requirementId: string,
  reading: { coverage: Coverage; reason: string },
): Promise<void> {
  await recordAnalysis(
    user.id,
    jobApplicationId,
    [{ requirementId, ...reading }],
    {
      rating: null,
      feedback: null,
    },
  );
}
