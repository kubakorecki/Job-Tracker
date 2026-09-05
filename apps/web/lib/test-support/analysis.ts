import type { Coverage } from "@repo/schema";
import type { CurrentUser } from "../auth/current-user";
import { recordAnalysedCoverage } from "../coverage/repository";

/**
 * What an Analysis leaves behind, for the tests that need a Requirement to
 * have been read by the model without there being an Analysis to run yet.
 *
 * It writes the two analysed columns and nothing else, which is exactly what
 * the Analysis itself will write — the override is a column neither of them
 * touches, and that is the whole reason a re-run cannot overwrite the user's
 * word (ADR-0004). When the Analysis endpoint exists this becomes a call to
 * it; until then this is the honest stand-in, and the tests that use it say
 * what they are standing in for.
 */
export async function giveAnalysedCoverage(
  user: CurrentUser,
  requirementId: string,
  reading: { coverage: Coverage; reason: string },
): Promise<void> {
  await recordAnalysedCoverage(user.id, requirementId, reading);
}
