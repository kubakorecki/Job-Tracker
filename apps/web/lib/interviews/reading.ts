import type { Interview } from "@repo/schema";
import { dayOf, daysBetween, shortDayOf } from "../day";

/**
 * What a Job Application's meetings amount to today: the one still to come, and
 * the last one that happened.
 *
 * Those two are the whole of what the rest of the app asks of an Interview. A
 * meeting still to come means there is no silence to report and is the one
 * thing worth a tag on a card; the last one held is where a silence is counted
 * from, in place of the `updated_at` that used to stand in for it (ADR-0011).
 * Both are read here rather than at each surface, so the tag on a card, the
 * count on the board and the thread on the page cannot come to three views of
 * one recruitment.
 *
 * It is arithmetic and wording only, like `closingOf` and `silenceOf` beside
 * it, and `today` is an argument rather than a call to the clock — which is
 * what makes every case testable and what keeps the server's render and the
 * browser's agreeing.
 *
 * A meeting that was called off is passed over by both. It stays in the list,
 * marked, because arranging it was still something the employer did — but when
 * it was called off is nowhere in the record, so it can neither end a silence
 * nor start one. Counting from the day it would have been held would be
 * counting from a day on which nothing happened.
 */

/** The meetings a reading is made from, in whatever order they arrive. */
type Arranged = readonly Interview[];

/**
 * Whether a meeting is still ahead of the user. The one place the line between
 * a meeting to come and a meeting held is drawn, because four readings turn on
 * it — the tag on a card, the silence, the beat the rail ends on, and the tense
 * a Conversation is told to write in — and four copies of `heldOn >= today`
 * would be four chances to draw it differently.
 *
 * A meeting held today is still to come. Nobody is being ignored on the morning
 * of their interview; the day itself is the one day a card most needs to say so;
 * and counting a silence from a meeting that has not happened would start the
 * count this morning.
 *
 * It says nothing about whether the meeting was called off, which is a separate
 * question and `standing`'s.
 */
export function stillToCome(interview: Interview, today: string): boolean {
  return interview.heldOn >= today;
}

/**
 * The next meeting standing, or `null` where none is — which is not the same as
 * a recruitment with no meetings in it, and both read the same way here on
 * purpose: what matters to every caller is whether anything is still to come.
 */
export function nextInterview(
  interviews: Arranged,
  today: string,
): Interview | null {
  return standing(interviews)
    .filter((interview) => stillToCome(interview, today))
    .reduce(soonest, null);
}

/**
 * The most recent meeting actually held, or `null` where none has been. This is
 * the real "last heard from them" that `silence.ts` was written waiting for.
 *
 * Exactly the meetings `nextInterview` passes over, which is what `stillToCome`
 * above is for: between them the two readings account for every meeting
 * standing, and neither can come to claim one the other has.
 */
export function lastInterviewHeld(
  interviews: Arranged,
  today: string,
): Interview | null {
  return standing(interviews)
    .filter((interview) => !stillToCome(interview, today))
    .reduce(latest, null);
}

/**
 * The next meeting in the few words a card or a table cell has room for. The
 * words carry the meaning on their own, as every tag's do — "Interview 24 Sep",
 * never a coloured dot.
 *
 * The day rather than a countdown, which is the other way round from a Closing
 * Date: a closing date is a deadline, where what matters is how long is left,
 * and a meeting is an appointment, where what matters is which day to keep
 * free. The two days at the near end are said in words, because "Interview
 * today" is what a person would say and reads faster than a date they have to
 * compare with the calendar.
 */
export function nextInterviewLabel(next: Interview, today: string): string {
  const days = daysBetween(today, next.heldOn);

  if (days === 0) return "Interview today";
  if (days === 1) return "Interview tomorrow";
  return `Interview ${shortDayOf(next.heldOn)}`;
}

/**
 * The next meeting as the sentence the label abbreviates: which stage it is,
 * the whole day including the year the tag has no room for, the time where the
 * user knows it, and how far off it is. It is what a pointer and a screen
 * reader are given.
 */
export function nextInterviewDescription(
  next: Interview,
  today: string,
): string {
  const at = next.heldAt === null ? "" : ` at ${next.heldAt}`;

  return `${next.stage} on ${dayOf(next.heldOn)}${at}, ${ahead(daysBetween(today, next.heldOn))}.`;
}

/**
 * The meetings in the order they are held, which is the order every surface
 * lists them in.
 *
 * It is the browser's copy of the repository's `ORDER BY` — the relationship
 * `appliedAtAfterMove` has with the applied date's rule on the server. The page
 * is handed the list already in order, and needs this the moment it puts a
 * newly arranged meeting into the list it is holding: a meeting arranged today
 * for next week belongs where it will be held, not at the end.
 *
 * A meeting nobody has a time for sorts last within its day, exactly as
 * Postgres puts it: it is the one the day cannot place, and putting it first
 * would claim a time it has not got.
 *
 * Two meetings on one day at one time are the one case this cannot decide for
 * itself. The repository breaks that tie on `created_at`, which an Interview
 * does not carry — the two dates worth knowing about a meeting are the user's
 * own, and a stamp in the contract would be a field for this sort and nothing
 * else. The sort is stable instead, so a list that arrived in the server's
 * order keeps it, and a meeting just arranged is appended and stays last —
 * which is where `created_at` puts it anyway.
 */
export function inTheOrderHeld(interviews: Arranged): Interview[] {
  return [...interviews].sort(
    (one, other) =>
      compared(one.heldOn, other.heldOn) ||
      compared(one.heldAt, other.heldAt) ||
      0,
  );
}

/** Two days, two times, or two nothings — a nothing sorting last. */
function compared(one: string | null, other: string | null): number {
  if (one === other) return 0;
  if (one === null) return 1;
  if (other === null) return -1;
  return one < other ? -1 : 1;
}

/** The meetings that were not called off, which are the only ones that count. */
function standing(interviews: Arranged): Interview[] {
  return interviews.filter((interview) => !interview.cancelled);
}

/**
 * Whichever of the two is held first, and whichever last. The list arrives in
 * the order it is held — that is the order the repository reads it in — but
 * these do not lean on it: a reading that quietly depended on an ORDER BY
 * elsewhere would come apart the first time a caller built a list by hand.
 */
function soonest(one: Interview | null, other: Interview): Interview {
  return one === null || other.heldOn < one.heldOn ? other : one;
}

function latest(one: Interview | null, other: Interview): Interview {
  return one === null || other.heldOn > one.heldOn ? other : one;
}

/**
 * How far off a day still ahead is. `closingDescription` counts the same days
 * and words one of them differently on purpose: a closing date says "in 1 day",
 * because it is a deadline and what matters is how much is left, and a meeting
 * says "tomorrow", because it is an appointment and that is what a person would
 * call it.
 */
function ahead(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}
