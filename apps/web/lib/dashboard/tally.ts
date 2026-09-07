import type { JobApplication } from "@repo/schema";
import { silenceOf } from "../job-applications/silence";

/**
 * The four numbers the board opens with, and the two the toolbar's silence
 * filter is labelled by. One pass over the whole list, before any narrowing:
 * the tally is a statement about the user's job hunt, and a tally that moved
 * as they typed in the search box would be a statement about the search box.
 *
 * All six come out of one object because they are one reading of one list, and
 * two functions counting the same Job Applications twice is how the sentence
 * and the chip beneath it come to disagree.
 */
export type Tally = {
  /** Everything recorded, whatever has become of it. */
  tracked: number;
  /** Sent, and not yet answered: the ones the user is actually waiting on. */
  inTheAir: number;
  /** Of those, the ones that have gone quiet — any reading at all. */
  quiet: number;
  /** Quiet for three weeks. */
  cold: number;
  /** Quiet for six, and the number the sentence is really about. */
  ghosted: number;
  offers: number;
};

export function tallyOf(
  jobApplications: readonly JobApplication[],
  today: string,
): Tally {
  const tally: Tally = {
    tracked: jobApplications.length,
    inTheAir: 0,
    quiet: 0,
    cold: 0,
    ghosted: 0,
    offers: 0,
  };

  for (const jobApplication of jobApplications) {
    if (jobApplication.status === "offer") tally.offers += 1;

    if (
      jobApplication.status === "applied" ||
      jobApplication.status === "interviewing"
    ) {
      tally.inTheAir += 1;
    }

    const silence = silenceOf(jobApplication, today);
    if (silence === null) continue;

    tally.quiet += 1;
    if (silence.kind === "cold") tally.cold += 1;
    if (silence.kind === "ghosted") tally.ghosted += 1;
  }

  return tally;
}

/**
 * One clause of the tally: a number and the words that go with it. The words
 * are held apart from the number because the sentence sets them differently —
 * the numbers in `ink`, the words around them in `ink-faint` — and because a
 * clause with nothing to report is dropped rather than written as a zero.
 */
export type TallyClause = { count: number; says: string };

/**
 * The tally as the sentence it is read as. Written in the second person and in
 * plain arithmetic, because it is the one place the app speaks about the user
 * rather than about the data:
 *
 *     14 tracked. 6 still in the air. 3 have gone quiet on you. 1 offer.
 *
 * Clauses that would report nothing are left out. "0 have gone quiet on you"
 * is technically the news the user most wants and reads as a complaint that
 * there is none of it; a shorter sentence says the same thing by not saying
 * it. The count of everything stays whatever it is, including none — a board
 * with nothing on it has its own screen, and this never runs on one.
 */
export function tallyClauses(tally: Tally): TallyClause[] {
  const clauses: TallyClause[] = [{ count: tally.tracked, says: "tracked." }];

  if (tally.inTheAir > 0) {
    clauses.push({ count: tally.inTheAir, says: "still in the air." });
  }

  if (tally.quiet > 0) {
    clauses.push({ count: tally.quiet, says: "have gone quiet on you." });
  }

  if (tally.offers > 0) {
    clauses.push({
      count: tally.offers,
      says: tally.offers === 1 ? "offer." : "offers.",
    });
  }

  return clauses;
}
