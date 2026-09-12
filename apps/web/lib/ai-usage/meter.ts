import { aiUsageSoFar } from "./repository";

/**
 * AI Usage: what one user has spent on the model this month, in tokens, and
 * whether they may start another call. Reading a Posting, reading a CV, an
 * Analysis and every Conversation turn all count into it, because it is one
 * grant behind all of them and one number is what the user is shown.
 *
 * The other limit is the daily Model Call count in `../model-calls/budget`.
 * The two are not the same question and neither can do the other's job: this
 * one is what a month of honest use costs, and that one is what a leaked
 * Personal Access Token can spend in a day (ADR-0009).
 */

/**
 * How many tokens a user may spend in a month.
 *
 * Sized against Gemini 2.5 Pro's published rates, confirmed at
 * ai.google.dev/gemini-api/docs/pricing on 2026-09-11: $1.25 per million input
 * tokens and $10.00 per million output tokens — thinking billed as output —
 * for prompts under 200k. The product's traffic is mostly prompt: a Posting, a
 * CV and a Job Application go up, and a paragraph comes back. At roughly four
 * input tokens per output token that blends to about $3.25 a million, so three
 * million is on the order of ten dollars a month.
 *
 * In what the user actually does, that is roughly a hundred and fifty
 * Conversation turns carrying the CV and a Job Application, alongside a
 * month's extractions and Analyses — comfortably more than a person applying
 * for jobs does, and bounded enough to be worth showing them.
 */
export const MONTHLY_AI_USAGE_LIMIT = 3_000_000;

/**
 * The status a caller answers a spent allowance with. The same number the
 * daily ceiling answers with, because both mean "not this request" to
 * anything mechanical reading the response — what differs is what the user is
 * told, which is the sentence below rather than the code.
 */
export const AI_USAGE_LIMIT_STATUS = 429;

/**
 * What a user is told when the month's AI Usage is gone. Shared so that it
 * reads the same from every endpoint, and deliberately unlike the daily
 * ceiling's sentence next to it: this one is an ordinary end of an ordinary
 * month and says when it comes back, and that one is a fault the user should
 * never see (ADR-0009).
 *
 * It points at the Profile because ADR-0009 asks this refusal to show the
 * meter, and every endpoint that says this renders it as plain words — so the
 * pointer is words too, rather than a link one of them could offer and the
 * extension could not.
 */
export const AI_USAGE_SPENT_MESSAGE =
  "You have spent this month's AI Usage. It starts again on the first of next month; your Profile shows the meter.";

/** Whether a call may start, or the month's allowance is already gone. */
export type AiUsageCheck = "within-limit" | "over-limit";

/**
 * Whether this user may start a call now.
 *
 * Asked before a call begins and never again while it runs: a streamed reply
 * cannot be priced until its last chunk arrives, so a call admitted within the
 * limit is allowed to finish and overshoot it. The overshoot is one call's
 * worth, and the alternative is cutting off a half-written cover letter over
 * an accounting boundary (ADR-0009).
 *
 * The comparison is against what has been spent, not what this call will
 * spend, because what it will spend is not knowable until it has.
 */
export async function mayStartAiCall(userId: string): Promise<AiUsageCheck> {
  return aiUsageAt(await aiUsageSoFar(userId));
}

/**
 * The comparison itself, over a total already in hand.
 *
 * It is here, apart from the read above it, because the Profile's meter asks
 * the same question of a total it has already read and must not answer it
 * differently — a page saying the month has room while the next call refuses
 * would be two limits wearing one name. Everything that starts a call goes
 * through `mayStartAiCall`; this is for whatever is only describing a month.
 */
export function aiUsageAt(spent: number): AiUsageCheck {
  return spent >= MONTHLY_AI_USAGE_LIMIT ? "over-limit" : "within-limit";
}
