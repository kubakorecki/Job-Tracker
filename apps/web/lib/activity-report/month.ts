import { dayInZone } from "../day";

/**
 * The month an Activity Report is about, and which days belong to it.
 *
 * A month here is `YYYY-MM` — the prefix every `YYYY-MM-DD` in this app
 * already carries, so asking whether a day falls in a month is a comparison
 * rather than a calculation, and no Date is built to answer it.
 *
 * The boundaries are the browser's zone rather than UTC, which is the one
 * place the app departs from `../day`'s fixed zone (ADR-0012). The report is
 * proposed in the browser from data the page was handed, so there is no second
 * render for the two to disagree between — and the month it is about is the
 * user's own month, not the server's.
 */

/** A month, as `YYYY-MM`. */
export type Month = string;

/** How many months the selector offers, counting back from this one. */
export const MONTHS_OFFERED = 12;

/** The month a calendar day falls in. */
export function monthOfDay(day: string): Month {
  return day.slice(0, 7);
}

/** The month one of the contract's instants fell in, where the user was. */
export function monthOfInstant(iso: string, zone: string): Month {
  return monthOfDay(dayInZone(iso, zone));
}

/** Whether a calendar day is one of the month's own. */
export function fallsIn(day: string, month: Month): boolean {
  return monthOfDay(day) === month;
}

/**
 * The month before — which is the month a report defaults to, because a report
 * is handed in for the month that has finished.
 */
export function previousMonth(month: Month): Month {
  const [year, ordinal] = split(month);
  return ordinal === 1 ? asMonth(year - 1, 12) : asMonth(year, ordinal - 1);
}

/**
 * The months the selector offers, newest first: the one given and the ones
 * before it. A user correcting a report they sent in March still has to be
 * able to reach it, and a list a year long is one select's worth.
 */
export function monthsUpTo(month: Month, count: number): Month[] {
  const months: Month[] = [];

  for (
    let standing = month;
    months.length < count;
    standing = previousMonth(standing)
  ) {
    months.push(standing);
  }

  return months;
}

/** A month as its two numbers. */
function split(month: Month): [year: number, ordinal: number] {
  return [Number(month.slice(0, 4)), Number(month.slice(5, 7))];
}

/** Two numbers as a month, the ordinal padded so that months sort as strings. */
function asMonth(year: number, ordinal: number): Month {
  return `${year}-${String(ordinal).padStart(2, "0")}`;
}
