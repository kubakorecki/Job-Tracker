import { countModelCall } from "./repository";

/**
 * The one daily count every model call spends from — job extraction, reading
 * a CV, an Analysis and a Conversation turn alike. It is one API key and one
 * grant behind all of them, and the reason the limit exists is indifferent to
 * which call drained it, so there is one counter and one answer rather than
 * four of each.
 *
 * This is not what a user has spent. That is AI Usage, in `../ai-usage`,
 * counted in tokens against a monthly limit and the only measure of cost the
 * product shows. This count is plumbing nobody is told about (ADR-0009).
 */

/**
 * How many model calls a user may spend in a day.
 *
 * It exists *only* to cap what a leaked Personal Access Token can spend in a
 * day before the user notices it and revokes it. It is not a ration and it is
 * not a budget: what a user has spent is AI Usage's business, and the ceiling
 * here is set high enough that honest use never reaches it. A user who does
 * reach it has a runaway client or a stolen credential, which is the only
 * thing this number is asked to notice.
 */
export const DAILY_MODEL_CALL_LIMIT = 300;

/**
 * The status a caller answers with when the ceiling is hit. Shared so that it
 * reads the same from every endpoint.
 */
export const MODEL_CALL_LIMIT_STATUS = 429;

/**
 * What a user is told if they ever hit the ceiling — which they should not,
 * so it says something is wrong rather than inviting them to wait. A spent AI
 * Usage allowance is the refusal they are meant to see, and it reads nothing
 * like this one (ADR-0009).
 */
export const MODEL_CALL_CEILING_MESSAGE =
  "This account has made an unusual number of requests today and has been stopped as a precaution. If that was not you, revoke your Personal Access Tokens.";

/** Whether a call may go ahead, or has nothing left to spend. */
export type ModelCallSpend = "spent" | "over-limit";

/**
 * Spends one model call for a user and says whether it was within the day's
 * ceiling.
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
