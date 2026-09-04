import { countModelCall } from "./repository";

/**
 * The one daily budget every model call spends from — job extraction, reading
 * a CV, and an Analysis alike. It is one API key and one grant behind all
 * three, and the reason the limit exists is indifferent to which call drained
 * it, so there is one counter and one answer rather than three of each.
 */

/**
 * How many model calls a user may spend in a day. High enough that personal
 * use never reaches it, low enough that a leaked Personal Access Token cannot
 * spend the whole grant before the user notices and revokes it.
 */
export const DAILY_MODEL_CALL_LIMIT = 100;

/**
 * The status a caller answers with when the budget is gone. Shared so that a
 * spent allowance reads the same from every endpoint: the client's right
 * response to it is to wait, whichever call it was making.
 */
export const MODEL_CALL_LIMIT_STATUS = 429;

/** Whether a call may go ahead, or has nothing left to spend. */
export type ModelCallSpend = "spent" | "over-limit";

/**
 * Spends one model call for a user and says whether it was within the day's
 * allowance.
 *
 * Call it before reaching the provider, not after, so that a call which
 * reached the provider counts whether or not it came back with anything. Every
 * caller does, which is the whole of the rule — there is nowhere else to put
 * it, because spending is what asks the question.
 *
 * The counter keeps climbing past the limit for a client that keeps asking;
 * nothing reads it but this function, and a refusal is a refusal at 101 as
 * much as at 5,000.
 */
export async function spendModelCall(userId: string): Promise<ModelCallSpend> {
  return (await countModelCall(userId)) > DAILY_MODEL_CALL_LIMIT
    ? "over-limit"
    : "spent";
}
