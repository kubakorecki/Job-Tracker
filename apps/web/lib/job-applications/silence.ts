import type { JobApplication, JobStatus } from "@repo/schema";
import { dayIn, dayOf, daysBetween } from "../day";
import { lastInterviewHeld, nextInterview } from "../interviews/reading";

/**
 * How long it has been since anything happened on a Job Application the user
 * is waiting on — the subject the whole board is arranged around.
 *
 * Silence is its own axis, orthogonal to Status. Status is what the user set;
 * silence is what happened to them, and the two are drawn differently
 * everywhere so they never read as one thing (`docs/design-system.md`).
 *
 * It is arithmetic and wording only. The tag and its colour are the
 * component's (`app/dashboard/silence-tag.tsx`), and every surface that shows
 * a reading goes through here, so the board, the table and the detail view
 * cannot come to three views of the same wait.
 */

/**
 * The three readings a wait can have. There is no fourth for a fresh one: a
 * week of quiet is not a reading, it is the ordinary state of a job
 * application, and a tag on every card would say nothing.
 *
 * - `quiet` — long enough to notice, short enough to mean nothing.
 * - `cold` — long enough that it is probably not coming.
 * - `ghosted` — long enough to stop counting.
 */
export type SilenceKind = "quiet" | "cold" | "ghosted";

/**
 * A wait, read against today. The day it is counted from rides along, so that
 * everything there is to say about a silence is said from the silence — a
 * sentence assembled from a reading and a separately-passed date is a sentence
 * that can be assembled from the wrong pair.
 */
export type Silence = {
  kind: SilenceKind;
  /** Whole days since `since`, never negative. */
  days: number;
  /** The UTC day the counting starts from. */
  since: string;
};

/**
 * A week, because that is how long a person waits without thinking about it.
 * Under it there is no reading at all.
 */
export const QUIET_AFTER_DAYS = 8;

/**
 * Three weeks: past the fortnight every "we'll be in touch shortly" implies,
 * and the point at which a person starts to suspect rather than to wonder.
 */
export const GOING_COLD_AFTER_DAYS = 21;

/**
 * Six weeks and a bit. Long enough that a reply would be a surprise rather
 * than a delay — which is the whole of what the word means here.
 */
export const GHOSTED_AFTER_DAYS = 45;

/** As much of a Job Application as a reading is made from. */
type Waiting = Pick<
  JobApplication,
  "status" | "appliedAt" | "updatedAt" | "interviews"
>;

/**
 * Whether there is anybody to be waiting on at all.
 *
 * A `bookmarked` Job Application has nobody to hear from; an `offer`, a
 * `rejected` or a `withdrawn` one has already been answered, and counting the
 * days since would be the board sulking about a question that got its answer.
 *
 * It is exported because the thread asks the same question before it ends on a
 * meeting still to come (`thread.ts`): a Job Application that has been answered
 * ends on the answer, whatever somebody forgot to take out of the diary. Two
 * copies of the list of four Statuses would be two things to change when one
 * moves.
 */
export function waitingOnSomebody(status: JobStatus): boolean {
  return status === "applied" || status === "interviewing";
}

/**
 * How this Job Application's wait reads today, or `null` where there is no
 * wait to report — which is not the same as a wait of zero days, and must not
 * draw anything.
 *
 * Only somebody the user is waiting on can go quiet, which is
 * `waitingOnSomebody` above.
 *
 * A meeting still to come is the other way of having nothing to report, and the
 * happier one: nobody has gone quiet on somebody they are seeing next week
 * (ADR-0011). It is asked after the Status rather than before it, because a
 * Job Application that has been rejected is answered whatever is in the diary.
 */
export function silenceOf(
  { status, appliedAt, updatedAt, interviews }: Waiting,
  today: string,
): Silence | null {
  if (!waitingOnSomebody(status)) return null;
  if (nextInterview(interviews, today) !== null) return null;

  const since = lastHeardOf({ appliedAt, updatedAt, interviews }, today);
  const days = daysBetween(since, today);

  // A date the user put in the future counts as nothing having happened yet
  // rather than as a wait running backwards.
  if (days < QUIET_AFTER_DAYS) return null;

  return { kind: kindOf(days), days, since };
}

/**
 * The last day anything happened on this Job Application: the day of the last
 * meeting held, where one has been, and otherwise the later of the day the user
 * applied and the day the record last changed.
 *
 * A meeting held is the real "last heard from them" this function was written
 * waiting for, and it outranks the other two outright rather than joining the
 * comparison: an employer who saw the user three weeks ago has been heard from
 * three weeks ago, whether or not a note was typed on the record since.
 *
 * Where no meeting has been held, `updatedAt` still stands in, and it is worth
 * being plain about what that is and is not. Moving a card to Interviewing,
 * correcting a Requirement and fixing a typo in the company name are all one
 * thing to the database, and only the first of them is news — so a stray edit
 * resets the count. That is the error to prefer: resetting understates a
 * silence, and the worst it costs is a tag appearing a few days late, where the
 * other way round the board would tell the user they had been ghosted by
 * somebody who wrote back last week. A tracker that cries wolf about silence
 * has lost the one thing it was for.
 */
export function lastHeardOf(
  { appliedAt, updatedAt, interviews }: Omit<Waiting, "status">,
  today: string,
): string {
  const met = lastInterviewHeld(interviews, today);
  if (met !== null) return met.heldOn;

  const changed = dayIn(updatedAt);
  if (appliedAt === null) return changed;

  const applied = dayIn(appliedAt);
  return applied > changed ? applied : changed;
}

/**
 * The silence in the few words a card or a table cell has room for. The words
 * carry the meaning on their own — "Going cold · 34d", never an amber dot —
 * so a reader who cannot tell ember from rose loses nothing.
 */
export function silenceLabel({ kind, days }: Silence): string {
  return `${KIND_LABELS[kind]} · ${days}d`;
}

/**
 * The silence as the sentence the tag abbreviates: the day the counting starts
 * from, which the tag never names, and the one thing that has to be said
 * alongside every count of it.
 */
export function silenceDescription({ days, since }: Silence): string {
  const day = days === 1 ? "1 day" : `${days} days`;
  return `Nothing has been heard since ${dayOf(since)} — ${day}. Nobody owes you a reply.`;
}

const KIND_LABELS: Record<SilenceKind, string> = {
  quiet: "Quiet",
  cold: "Going cold",
  ghosted: "Ghosted",
};

function kindOf(days: number): SilenceKind {
  if (days >= GHOSTED_AFTER_DAYS) return "ghosted";
  if (days >= GOING_COLD_AFTER_DAYS) return "cold";
  return "quiet";
}
