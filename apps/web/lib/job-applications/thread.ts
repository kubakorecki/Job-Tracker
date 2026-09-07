import type { JobApplication, JobStatus } from "@repo/schema";
import { dayOf } from "../day";
import { silenceOf, type SilenceKind } from "./silence";

/**
 * What has happened on one Job Application, in the order it happened, ending
 * in where it stands today.
 *
 * It is made only of what the record actually holds — the day it was saved,
 * the day it was sent, and how long it has been since either — and not of an
 * event log, because there is not one. Every beat here is a fact the database
 * can be asked for; nothing is inferred about a phone call nobody recorded.
 *
 * The silence it ends on is `silenceOf`'s reading, not a second count, so the
 * thread on the page and the tag on the card cannot disagree about the same
 * wait (`docs/design-system.md`).
 */

/**
 * How a beat is drawn, which is a reading rather than a decoration.
 *
 * - `event` — something happened, on a day, with a dot and a rule under it.
 * - `gap` — nothing happened, for a while. The rule breaks into a dash and the
 *   words go into the display face, because an absence is the one thing on
 *   this page that is not a record of anything.
 * - `now` — where it stands today, and the last beat of every thread.
 */
export type BeatKind = "event" | "gap" | "now";

/** One thing that happened, and when. */
export type Beat = {
  kind: BeatKind;
  /** The thing itself, in the fewest words that carry it. */
  what: string;
  /** The day, or — on the last beat — what today amounts to. */
  when: string;
};

/** As much of a Job Application as a thread is made from. */
type Recorded = Pick<
  JobApplication,
  "status" | "appliedAt" | "createdAt" | "updatedAt"
>;

export function threadOf(jobApplication: Recorded, today: string): Beat[] {
  const { status, appliedAt, createdAt, updatedAt } = jobApplication;

  const beats: Beat[] = [
    { kind: "event", what: "You saved it", when: dayOf(createdAt) },
  ];

  if (appliedAt !== null) {
    beats.push({ kind: "event", what: "You applied", when: dayOf(appliedAt) });
  }

  const silence = silenceOf(jobApplication, today);

  if (silence !== null) {
    const days = silence.days === 1 ? "1 day" : `${silence.days} days`;

    beats.push(
      {
        kind: "gap",
        what: "Then nothing.",
        when: `Nothing heard since ${dayOf(silence.since)}`,
      },
      {
        kind: "now",
        what: `${days} of quiet`,
        when: HOW_LONG_IS_THAT[silence.kind],
      },
    );

    return beats;
  }

  beats.push(STANDING[status](updatedAt));

  return beats;
}

/**
 * What each length of silence amounts to, said once here rather than at every
 * surface that reports one. It never says the user is owed anything, and the
 * one place it comes close says so plainly.
 */
const HOW_LONG_IS_THAT: Record<SilenceKind, string> = {
  quiet: "Long enough to notice. Not long enough to mean anything.",
  cold: "Long enough to stop waiting on it. Not long enough to call it.",
  ghosted: "Long enough to stop counting. Nobody owes you a reply.",
};

/**
 * Where a Job Application stands when no silence is running: either nobody has
 * it yet, or somebody has answered, or the wait is still ordinary.
 *
 * Keyed on Status because that is what settles it, and every Status has an
 * answer — a thread that ended in nothing for one of them would be a rail with
 * no end on a page that is otherwise a record of everything.
 */
const STANDING: Record<JobStatus, (updatedAt: string) => Beat> = {
  bookmarked: () => ({
    kind: "now",
    what: "Not applied for yet",
    when: "Nobody has it to ignore.",
  }),
  applied: () => stillFresh(),
  interviewing: () => stillFresh(),
  offer: (updatedAt) => answered("An offer", updatedAt),
  rejected: (updatedAt) => answered("They said no", updatedAt),
  withdrawn: (updatedAt) => answered("You withdrew", updatedAt),
};

/**
 * A wait under a week, which is not a reading. `silenceOf` deliberately has no
 * word for it, and this is the sentence that stands where the tag does not.
 */
function stillFresh(): Beat {
  return {
    kind: "now",
    what: "Nothing to read into yet",
    when: "Somebody has been heard from in the last week.",
  };
}

/** A Job Application somebody has answered, and the day the record says so. */
function answered(what: string, updatedAt: string): Beat {
  return { kind: "now", what, when: `Recorded ${dayOf(updatedAt)}` };
}
