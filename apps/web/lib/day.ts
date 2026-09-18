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
 *
 * The Activity Report's are the one exception, and they are an exception
 * because they are not the app talking: a printed sheet says its dates in the
 * language the user chose for the office, and Polish declines a month name
 * after a number. They live in `activity-report/wording.ts` beside the rest of
 * what that document says, and nothing formatted there is ever shown beside
 * anything formatted here.
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

/**
 * The zone the reader's browser is in — the one thing that can say which month
 * an evening belongs to for them.
 *
 * It is the one reading in this file that is not UTC, and the exception is
 * deliberate. Everything above formats in UTC because a record is rendered on
 * the server and again in the browser, and a date that changed with the
 * machine would be a different date in each. The Activity Report is not
 * rendered on the server at all: it is proposed in the browser, from data the
 * page was handed, because the month it is about is the user's own month — a
 * rejection that arrived at half past eleven on the last night of September
 * belongs to September's report, whatever UTC made of the hour (ADR-0012).
 */
export function browserZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Any of the contract's instants, as the calendar day it falls on in one zone.
 * `YYYY-MM-DD`, the form every day in this app is compared as.
 *
 * Assembled from the parts rather than formatted with a locale that happens to
 * print ISO order: a locale is a rendering decision and this is an identifier.
 */
export function dayInZone(iso: string, zone: string): string {
  const parts = partsIn(zone).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((one) => one.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Today in one zone, which is the only place the report reads the clock. */
export function todayInZone(zone: string): string {
  return dayInZone(new Date().toISOString(), zone);
}

/**
 * One formatter per zone, because building one costs more than formatting with
 * it and the report asks for a day of every Status Change it reads.
 */
const IN_ZONE = new Map<string, Intl.DateTimeFormat>();

function partsIn(zone: string): Intl.DateTimeFormat {
  const held = IN_ZONE.get(zone);
  if (held !== undefined) return held;

  const made = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: zone,
  });

  IN_ZONE.set(zone, made);
  return made;
}
