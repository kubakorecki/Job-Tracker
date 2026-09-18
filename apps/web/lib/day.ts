/**
 * A fixed locale and time zone rather than the reader's: a record can be
 * rendered on the server and again on the client, and a date that changes with
 * the machine would be a different date in each. Every date the app shows goes
 * through it, so they all agree.
 */
const DAY = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "UTC",
});

/** Any of the contract's instants, as a day the user can read. */
export function dayOf(iso: string): string {
  return DAY.format(new Date(iso));
}

const SHORT_DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/**
 * A day with the year left off: "24 Sep". For a tag on a board card, which has
 * room for a day and not for a year — and where the year is never in question,
 * because the tag is only ever about a day within a few weeks of today. The
 * sentence behind the tag says the whole date.
 */
export function shortDayOf(iso: string): string {
  return SHORT_DAY.format(new Date(iso));
}

const MONTH = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Any of the contract's instants, as the month it falls in: "September 2026".
 * Here rather than beside the one thing that says a month — AI Usage's meter —
 * because this file is where every date the app shows is formatted, and a
 * second fixed-locale formatter elsewhere is how two of them come to disagree.
 */
export function monthOf(iso: string): string {
  return MONTH.format(new Date(iso));
}

/**
 * Today, as the app counts days: a UTC calendar day. Read from the clock here
 * and nowhere else, so every function that reasons about a date takes the day
 * as an argument and can be tested at any point in the year.
 *
 * UTC rather than the reader's zone for the reason `dayOf` formats in it: the
 * board renders on the server and again in the browser, and a "today" that
 * differed between the two would count a different number of days in each.
 */
export function todayInUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Any of the contract's instants, as the UTC calendar day it falls on. */
export function dayIn(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/**
 * Whole days from one calendar day to another, positive where the second is
 * later. Both are `YYYY-MM-DD`, and both are read as UTC midnight, so no hour
 * of daylight saving can make a month come out a day short.
 */
export function daysBetween(from: string, to: string): number {
  const DAY_IN_MS = 24 * 60 * 60 * 1000;
  return (midnightUtc(to) - midnightUtc(from)) / DAY_IN_MS;
}

function midnightUtc(day: string): number {
  return Date.parse(`${day}T00:00:00.000Z`);
}
