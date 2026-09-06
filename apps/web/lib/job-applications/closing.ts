import type { JobApplication } from "@repo/schema";
import { dayOf } from "../day";

/**
 * What a Job Application's Closing Date amounts to today. The date is a fact
 * about the Posting; this is what the user should do about it, which depends
 * on where they are standing — a Closing Date three days off is an alarm on a
 * bookmark and nothing at all on a job already applied for (ADR-0007).
 *
 * It is arithmetic and wording only. The colour and the pill are the badge's
 * (`app/dashboard/closing-badge.tsx`), and every surface that shows a Closing
 * reads it through here, so the board, the table and the detail view cannot
 * come to three views of one date.
 */

/**
 * The four readings one Closing Date can have.
 *
 * - `open` — still to come, with time to spare or with no action left to take.
 * - `closing-soon` — within the week, and still only bookmarked: the one
 *   reading that asks something of the user.
 * - `missed` — passed, and still only bookmarked: this one got away.
 * - `closed` — passed, on a Job Application the user acted on: intake is over.
 */
export type ClosingKind = "open" | "closing-soon" | "missed" | "closed";

/**
 * A Closing Date read against today. The days are whole and never negative —
 * remaining ahead of the Closing Date, elapsed behind it — because which way
 * it points is the kind's business, and a caller that had to check the sign
 * as well as the kind would be reading one fact twice.
 *
 * The day it is about rides along, so that everything there is to say about a
 * Closing is said from the Closing. A sentence assembled from a reading and a
 * separately-passed date is a sentence that can be assembled from the wrong
 * pair.
 */
export type Closing = {
  kind: ClosingKind;
  days: number;
  /** The Closing Date itself, as the contract states it. */
  on: string;
};

/**
 * How near a Closing Date has to be before a bookmark is worth hurrying over.
 * A
 * week, because that is the horizon a person plans an application inside —
 * long enough to write a covering letter, short enough that the warning is
 * still about this week rather than a date in the calendar.
 */
export const CLOSING_SOON_DAYS = 7;

/**
 * Today, as the days below are counted in: a UTC calendar day. Read from the
 * clock here and nowhere else, so every function that reasons about a Closing
 * Date takes the day as an argument and can be tested at any point in the
 * year.
 *
 * UTC rather than the reader's zone for the reason `dayOf` formats in it: the
 * board renders on the server and again in the browser, and a "today" that
 * differed between the two would count a different number of days in each.
 */
export function todayInUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * What this Job Application's Closing Date says today, or `null` where it has
 * none — which is not the same as a Closing Date that has passed, and must
 * not draw anything.
 *
 * Only a `bookmarked` Job Application can be hurried or can have missed
 * anything: a Closing Date on one already applied for asks nothing of the user,
 * and an alarm with no action behind it teaches them to ignore the next one.
 */
export function closingOf(
  {
    closesOn,
    status,
  }: Pick<JobApplication, "closesOn" | "status">,
  today: string,
): Closing | null {
  if (closesOn === null) return null;

  const days = daysBetween(today, closesOn);
  // The Closing Date itself is still a day to apply on, so zero counts as ahead.
  const stillOpen = days >= 0;
  const couldStillAct = status === "bookmarked";

  if (stillOpen) {
    const soon = couldStillAct && days <= CLOSING_SOON_DAYS;
    return { kind: soon ? "closing-soon" : "open", days, on: closesOn };
  }

  return {
    kind: couldStillAct ? "missed" : "closed",
    days: -days,
    on: closesOn,
  };
}

/**
 * The Closing in the few words a card or a table cell has room for. The words
 * carry the meaning on their own: the badge's colour reinforces the two
 * readings that raise their voice, and a reader who cannot tell amber from
 * grey loses nothing (story 45's rule, applied here).
 *
 * The two readings ahead of the Closing Date read alike and so do the two
 * behind it, because how loudly a Closing is said is the badge's business
 * rather than a matter of what there is to say — "Closes in 3 days" is the same news whether or not the
 * user has acted on it.
 */
export function closingLabel({ kind, days }: Closing): string {
  if (kind === "open" || kind === "closing-soon") {
    if (days === 0) return "Closes today";
    if (days === 1) return "Closes tomorrow";
    return `Closes in ${days} days`;
  }

  if (days === 0) return "Closed today";
  if (days === 1) return "Closed yesterday";
  return `Closed ${days} days ago`;
}

/**
 * The Closing as the sentence the label abbreviates: the day itself, which the
 * label never names, and what it means for this Job Application. It is what a
 * pointer and a screen reader are given, because "Closed 30 days ago" on its
 * own says when but not what follows from it.
 */
export function closingDescription(closing: Closing): string {
  const day = dayOf(closing.on);

  switch (closing.kind) {
    case "open":
      return `Applications close on ${day}, ${ahead(closing.days)}.`;
    case "closing-soon":
      return `Applications close on ${day}, ${ahead(closing.days)} — apply before then.`;
    case "missed":
      return `Applications closed on ${day}, ${behind(closing.days)}, and this was never applied for.`;
    case "closed":
      // The one reading that answers a question the user actually has while
      // waiting: whether silence still means nothing. Before the Closing Date
      // the shortlist is not drawn; after it, how long it has been is the
      // whole of what tells them whether to keep waiting (ADR-0007).
      return `Applications closed on ${day}, ${behind(closing.days)}. Any contact now comes from them.`;
  }
}

/**
 * How far off a day still ahead is, and how long ago one behind was. The verb
 * in the sentence has already said which way the Closing Date lies, so these
 * say only how far — except on the day itself, where both are "today".
 */
function ahead(days: number): string {
  if (days === 0) return "today";
  return days === 1 ? "in 1 day" : `in ${days} days`;
}

function behind(days: number): string {
  if (days === 0) return "today";
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

/**
 * Whole days from one calendar day to another, positive where the second is
 * later. Both are `YYYY-MM-DD`, and both are read as UTC midnight, so no hour
 * of daylight saving can make a month come out a day short.
 */
function daysBetween(from: string, to: string): number {
  const DAY_IN_MS = 24 * 60 * 60 * 1000;
  return (midnightUtc(to) - midnightUtc(from)) / DAY_IN_MS;
}

function midnightUtc(day: string): number {
  return Date.parse(`${day}T00:00:00.000Z`);
}
