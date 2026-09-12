import { aiUsageReading, type AiUsageReading } from "./reading";
import { aiUsageMonth, aiUsageSoFar } from "./repository";

/**
 * AI Usage as the page outside this feature sees it: the month's meter, read
 * and put into words.
 *
 * It sits apart from `./reading` for the reason `../profile/view` sits apart
 * from its contract — the Profile page renders on the server, where an HTTP
 * hop to this app's own API would buy nothing, and reading a meter is a query
 * and a clock rather than arithmetic.
 *
 * The clock is read here, and this is the only function under `./` that reads
 * one: everything below it takes its month as an argument, which is what lets
 * `./reading` be tested at any point in the year. No month is offered here
 * because nothing asks for one — a default nobody reaches is a seam that
 * cannot be trusted, which is the rule `../profile/view` states.
 */

/**
 * What this user has spent this month, and what that amounts to. Every month
 * has a reading, including one nothing has been spent in: an untouched meter
 * is the ordinary state at the start of a month, and the page says so rather
 * than drawing nothing.
 */
export async function readAiUsage(userId: string): Promise<AiUsageReading> {
  const month = aiUsageMonth();

  return aiUsageReading(await aiUsageSoFar(userId, month), month);
}
