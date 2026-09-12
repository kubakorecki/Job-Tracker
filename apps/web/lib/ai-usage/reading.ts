import { monthOf } from "../day";
import { aiUsageAt, MONTHLY_AI_USAGE_LIMIT } from "./meter";

/**
 * AI Usage as the Profile draws it: what one month has spent, how much of the
 * monthly limit that is, when it comes back, and all of it in a sentence.
 *
 * It is the same reading the check before a call makes and not a second one —
 * `isSpent` is `aiUsageAt`'s own comparison, so the page and the endpoint
 * cannot come to different conclusions about whether a month is over.
 *
 * Arithmetic and wording only, so both can be tested without rendering a page
 * or standing a meter up in the database — the same arrangement
 * `../coverage/fit-banner` makes for the fit, and the reason nothing is left
 * for the component to work out.
 */

/** What the meter says, before anything draws it. */
export type AiUsageReading = {
  /** Tokens spent in the month, as the meter holds them. */
  spent: number;
  /**
   * The share of the month's tokens spent, as a whole number of per cent —
   * the figure the panel says.
   *
   * Rounded up, so that spending which would round to nothing still reads as
   * something begun, and held below a hundred until the month is actually
   * spent: a meter reading 100% beside a Conversation that still answers
   * would be the page contradicting `mayStartAiCall`, and "one token left"
   * and "nothing left" are the two states this number exists to tell apart.
   *
   * Above a hundred it goes, once the month is over. A call admitted within
   * the limit is allowed to finish and overshoot it (ADR-0009), and a figure
   * stopped at 100 would quietly hide the one case where the limit did not
   * hold exactly.
   */
  percent: number;
  /**
   * The share the bar draws, which is `percent` with the overshoot taken off:
   * a bar past its own end draws nothing, and the figure above says what
   * really happened.
   */
  filled: number;
  /** Whether the month is spent, by the same comparison a call is refused on. */
  isSpent: boolean;
  /** The instant next month's tokens begin, for `dayOf` to say. */
  startsAgainOn: string;
  /** The month being read, as a month and a year: "September 2026". */
  monthSaid: string;
};

/**
 * One month's meter, read. `month` is the month's first UTC day, as the meter
 * is keyed on it (`aiUsageMonth`), and is an argument rather than read from
 * the clock here so that every sentence below can be tested at any point in
 * the year — the rule `../day` sets for everything that reasons about a date.
 */
export function aiUsageReading(spent: number, month: string): AiUsageReading {
  const began = `${month}T00:00:00.000Z`;
  const percent = shareSpent(spent);

  return {
    spent,
    percent,
    filled: Math.min(percent, 100),
    isSpent: aiUsageAt(spent) === "over-limit",
    startsAgainOn: monthAfter(began),
    monthSaid: monthOf(began),
  };
}

/**
 * The share of the month's tokens spent, as the panel says it.
 *
 * Rounded up at both ends but never over a boundary that means something
 * else: nought is "this month has not begun" and a hundred is "this month is
 * over", so anything spent inside the limit is somewhere between the two,
 * however little or much of it there is.
 */
function shareSpent(spent: number): number {
  if (spent === 0) return 0;

  // Multiplied before it is divided: the other order turns an exact fourteen
  // per cent into 14.000000000000002, which rounds up to fifteen.
  const exact = (spent * 100) / MONTHLY_AI_USAGE_LIMIT;

  return aiUsageAt(spent) === "over-limit"
    ? Math.ceil(exact)
    : Math.min(99, Math.ceil(exact));
}

/**
 * The meter in a sentence, addressed to the user: what they have spent, of
 * what, in tokens — because tokens are what is metered, and a bar alone says
 * nothing to a screen reader or to anyone who reads the colour the other way
 * round.
 *
 * A spent month is worded apart from the other two and says the month is the
 * reason, because it is the one refusal the user is meant to meet and it is an
 * ordinary end of an ordinary month rather than a fault (ADR-0009). It names
 * what will wait for the new month in the same terms the panel names what
 * spends: nothing here is about plans, tiers or payment, and nothing should
 * be.
 *
 * It is AI Usage and a monthly limit throughout, which is how `CONTEXT.md`
 * words this — quota, credits, allowance and budget are all words it tells the
 * interface not to use. Nothing in it mentions the daily Model Call count,
 * here or anywhere else a user can see.
 */
export function aiUsageSentence(reading: AiUsageReading): string {
  const { spent, percent, isSpent } = reading;
  const limit = inTokens(MONTHLY_AI_USAGE_LIMIT);

  if (isSpent) {
    return `You have spent this month's AI Usage: ${inTokens(spent)} tokens against a monthly limit of ${limit}. That is the month ending rather than a fault — reading a Posting, reading a CV, an Analysis and a Conversation all wait for the new month.`;
  }

  if (spent === 0) {
    return `You have spent nothing this month. All ${limit} tokens of the monthly limit are still there.`;
  }

  return `You have spent ${inTokens(spent)} tokens this month, against a monthly limit of ${limit} — ${percent}% of it.`;
}

/**
 * The first instant of the month after the one the given instant falls in.
 * Built out of `Date.UTC` rather than by adding thirty days, so a December
 * reads as the January of the next year and no month is ever a day out.
 */
function monthAfter(instant: string): string {
  const began = new Date(instant);

  return new Date(
    Date.UTC(began.getUTCFullYear(), began.getUTCMonth() + 1, 1),
  ).toISOString();
}

const TOKENS = new Intl.NumberFormat("en-GB");

/** A token count grouped, so seven figures can be read at a glance. */
function inTokens(tokens: number): string {
  return TOKENS.format(tokens);
}
