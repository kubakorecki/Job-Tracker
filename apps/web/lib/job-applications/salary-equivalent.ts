import type { JobApplication, SalaryPeriod } from "@repo/schema";
import { SALARY_PERIOD_LABELS } from "@repo/ui/salary-period";

/**
 * A recorded salary restated over the Salary Period the user reads salaries
 * in, so that Job Applications quoted over different periods can be set side
 * by side and ranked.
 *
 * It is arithmetic and wording only, worked out wherever it is shown and never
 * stored. ADR-0006 keeps a salary as the Posting states it because the
 * multiplier is a guess; this is where that guess is made, in the open — every
 * figure it changed says so, and the rule it used is one hover away.
 *
 * It restates the period and never the currency. Two Salary Equivalents in
 * different currencies are still not comparable, and keeping them apart is the
 * ranking's business rather than a rate this module could guess.
 */

/**
 * How many of each period make one working year: 40 hours a week for 52 weeks.
 * Fixed rather than configurable, because a Salary Equivalent is for setting
 * Postings side by side, and one year applied to all of them does that however
 * the user's own year is shaped.
 */
export const WORKING_YEAR: Record<SalaryPeriod, number> = {
  annual: 1,
  monthly: 12,
  daily: 260,
  hourly: 2080,
};

/**
 * The two ends of a salary, at least one of them present. A salary with
 * neither is no salary, and the type says so, so that nothing downstream has to
 * decide what an empty range ranks as or reads as.
 */
export type SalaryBounds =
  | { min: number; max: number }
  | { min: number; max: null }
  | { min: null; max: number };

/**
 * A salary restated over `period`.
 *
 * The bounds are left unrounded — rounding is how a figure is written, not
 * what it is, and a ranking that sorted on rounded figures would tie salaries
 * the user can tell apart. What the Posting stated rides along, so that
 * everything there is to say about a Salary Equivalent is said from it.
 */
export type SalaryEquivalent = SalaryBounds & {
  /** The period the user reads salaries in, not the one the Posting used. */
  period: SalaryPeriod;
  currency: string | null;
  /** Whether the arithmetic changed the figure — the stated period differs. */
  approximate: boolean;
  stated: SalaryBounds & { period: SalaryPeriod };
};

/**
 * This Job Application's salary restated over `period`, or `null` where there
 * is nothing to restate: no bound recorded, or a bound recorded without the
 * period that says what it is a rate over, which means nothing on its own
 * (ADR-0006) and must not be guessed into a month.
 */
export function salaryEquivalentOf(
  {
    salaryMin,
    salaryMax,
    salaryPeriod,
    currency,
  }: Pick<
    JobApplication,
    "salaryMin" | "salaryMax" | "salaryPeriod" | "currency"
  >,
  period: SalaryPeriod,
): SalaryEquivalent | null {
  if (salaryPeriod === null) return null;

  const stated = boundsOf(salaryMin, salaryMax);
  if (stated === null) return null;

  return {
    ...scaled(stated, WORKING_YEAR[salaryPeriod] / WORKING_YEAR[period]),
    period,
    currency,
    approximate: salaryPeriod !== period,
    stated: { ...stated, period: salaryPeriod },
  };
}

function boundsOf(min: number | null, max: number | null): SalaryBounds | null {
  if (min === null) return max === null ? null : { min, max };
  return max === null ? { min, max } : { min, max };
}

function scaled(bounds: SalaryBounds, by: number): SalaryBounds {
  if (bounds.min === null) return { min: null, max: bounds.max * by };
  if (bounds.max === null) return { min: bounds.min * by, max: null };
  return { min: bounds.min * by, max: bounds.max * by };
}

/**
 * The one number a Salary Equivalent is ranked by: the middle of its range, or
 * the one bound it has. The middle rather than the top, because a Posting that
 * prints a wide, hopeful range — or one widened across contract types, as
 * ADR-0006 records — should not outrank a narrower one that pays more.
 */
export function salaryRankOf(equivalent: SalaryEquivalent): number {
  if (equivalent.min === null) return equivalent.max;
  if (equivalent.max === null) return equivalent.min;
  return (equivalent.min + equivalent.max) / 2;
}

/**
 * How each period is shortened where a card or a table cell has no room for
 * `SALARY_PERIOD_LABELS`' full word.
 */
const PERIOD_SUFFIXES: Record<SalaryPeriod, string> = {
  annual: "yr",
  monthly: "mo",
  daily: "day",
  hourly: "h",
};

/**
 * A Salary Equivalent in the few characters a card or a table cell has room
 * for: `17–26.1k PLN / mo`, `from 212 GBP / day`.
 *
 * It does not carry the `≈`. Whether to draw one is `approximate`, and the mark
 * is its own element on the page, because it is what the hover text hangs off.
 */
export function salaryLabel(equivalent: SalaryEquivalent): string {
  const unit = [equivalent.currency, `/ ${PERIOD_SUFFIXES[equivalent.period]}`]
    .filter((part) => part !== null)
    .join(" ");

  return `${figuresOf(equivalent)} ${unit}`;
}

/**
 * What a pointer and a screen reader are given for a Salary Equivalent: the
 * salary as the Posting stated it, whole and in its own period, and — wherever
 * the figure was restated — the working year it was restated on, so the guess
 * ADR-0006 keeps out of the stored row is never out of sight.
 *
 * The period is worded as `SALARY_PERIOD_LABELS` words it, after "per", the
 * way the detail view and the side panel introduce it.
 */
export function salaryDescription({
  approximate,
  currency,
  stated,
}: SalaryEquivalent): string {
  const figures =
    stated.min === null
      ? `up to ${stated.max}`
      : stated.max === null
        ? `from ${stated.min}`
        : `${stated.min}–${stated.max}`;
  const priced = currency === null ? figures : `${figures} ${currency}`;
  const statedAs = `Stated as ${priced} per ${SALARY_PERIOD_LABELS[stated.period]}`;

  if (!approximate) return statedAs;

  return `${statedAs} · restated on a year of ${WORKING_YEAR.monthly} months, ${WORKING_YEAR.daily} days, ${WORKING_YEAR.hourly} hours`;
}

/** Where a figure stops being written whole and starts being written in thousands. */
const THOUSANDS_FROM = 10_000;

type Figure = { digits: string; thousands: boolean };

/**
 * One bound written short: whole below ten thousand, in thousands with at
 * most one decimal from there up. The choice is made on the rounded figure, so
 * that 9999.6 reads as `10k` rather than as `10000`.
 */
function figureOf(figure: number): Figure {
  const whole = Math.round(figure);
  if (whole < THOUSANDS_FROM)
    return { digits: String(whole), thousands: false };
  return { digits: String(Math.round(figure / 100) / 10), thousands: true };
}

function shortFormOf({ digits, thousands }: Figure): string {
  return thousands ? `${digits}k` : digits;
}

function figuresOf(bounds: SalaryBounds): string {
  if (bounds.max === null) return `from ${shortFormOf(figureOf(bounds.min))}`;
  if (bounds.min === null) return `up to ${shortFormOf(figureOf(bounds.max))}`;

  const low = figureOf(bounds.min);
  const high = figureOf(bounds.max);

  // A range that rounds to one figure is one figure.
  if (shortFormOf(low) === shortFormOf(high)) return shortFormOf(high);
  // Two bounds in thousands share the one `k`: `17–26.1k`, not `17k–26.1k`.
  if (low.thousands && high.thousands) {
    return `${low.digits}–${shortFormOf(high)}`;
  }
  return `${shortFormOf(low)}–${shortFormOf(high)}`;
}
