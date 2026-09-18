import type { Interview, JobApplication, JobStatus } from "@repo/schema";
import { dayIn, dayOf } from "../day";
import {
  nextInterview,
  nextInterviewDescription,
  nextInterviewLabel,
  stillToCome,
} from "../interviews/reading";
import { silenceOf, waitingOnSomebody, type SilenceKind } from "./silence";

/**
 * What has happened on one Job Application, in the order it happened, ending
 * in where it stands today.
 *
 * It is made only of what the record actually holds — the day it was saved,
 * the day it was sent, the meetings that were arranged and held, and how long
 * it has been since the last of them — and not of an event log, because there
 * is not one. Every beat here is a fact the database can be asked for; nothing
 * is inferred about a phone call nobody recorded.
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
  "status" | "appliedAt" | "createdAt" | "updatedAt" | "interviews"
>;

/**
 * A beat with the day it is placed by. The day is a calendar day so that
 * everything sorts against everything — a Job Application's stamps are instants
 * and an Interview's two dates are days, and comparing the two as `YYYY-MM-DD`
 * strings is the one comparison both can be put through.
 */
type Placed = { on: string; beat: Beat };

export function threadOf(jobApplication: Recorded, today: string): Beat[] {
  const { status, appliedAt, createdAt, updatedAt, interviews } =
    jobApplication;

  const placed: Placed[] = [
    { on: dayIn(createdAt), beat: saidOn("You saved it", createdAt) },
  ];

  if (appliedAt !== null) {
    placed.push({
      on: dayIn(appliedAt),
      beat: saidOn("You applied", appliedAt),
    });
  }

  for (const interview of interviews) {
    placed.push(...whatHappenedTo(interview, today));
  }

  // Sorted, because a recruitment does not arrive in order: a second round is
  // often arranged before the first is held, and either may have been typed in
  // at any time. The sort is stable, so two beats on one day stay in the order
  // they were put in — which puts the invitation before the meeting where a
  // meeting was arranged for the day it was offered.
  const beats = [...placed]
    .sort((one, other) => (one.on < other.on ? -1 : one.on > other.on ? 1 : 0))
    .map(({ beat }) => beat);

  // A meeting still in the diary is where the thread ends, and it is the
  // happier of the two reasons there is no silence to report (ADR-0011). The
  // words are the ones the tag on the board card uses, so the page and the card
  // say the same thing about the same meeting.
  //
  // Only where the user is actually waiting, which is the order `silenceOf`
  // reads the two in as well: a Job Application that has been answered is
  // answered whatever is in the diary, and a meeting nobody got round to
  // calling off must not push "They said no" off the end of the rail. The
  // invitation still draws its beat above — the employer did arrange it — but
  // where it stands today is the answer.
  const next = waitingOnSomebody(status)
    ? nextInterview(interviews, today)
    : null;
  if (next !== null) {
    beats.push({
      kind: "now",
      what: nextInterviewLabel(next, today),
      when: nextInterviewDescription(next, today),
    });

    return beats;
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

/** One thing that happened, on the day one of the record's stamps says. */
function saidOn(what: string, iso: string): Beat {
  return { kind: "event", what, when: dayOf(iso) };
}

/**
 * What one meeting puts in the thread: the invitation, and the meeting itself
 * once it has happened.
 *
 * Two beats, because they are two things the employer did and often fall in
 * different months — which is the whole reason an Interview carries both dates
 * (`CONTEXT.md`). A meeting still to come has only been arranged so far, and
 * appears in the thread as that plus the beat the thread ends on; drawing a
 * "you interviewed" beat for it would be the rail reporting the future.
 *
 * A meeting that was called off is one beat rather than two. It was never held,
 * so there is no holding to draw, and the invitation is what actually happened
 * — dated the day it arrived, saying what it was for and that it came to
 * nothing.
 */
function whatHappenedTo(interview: Interview, today: string): Placed[] {
  const { arrangedOn, heldOn, stage, cancelled } = interview;

  if (cancelled) {
    return [
      {
        on: arrangedOn,
        beat: {
          kind: "event",
          what: `${stage} — called off`,
          when: `Arranged ${dayOf(arrangedOn)}, for ${dayOf(heldOn)}`,
        },
      },
    ];
  }

  const arranged: Placed = {
    on: arrangedOn,
    beat: {
      kind: "event",
      what: `Interview arranged — ${stage}`,
      when: dayOf(arrangedOn),
    },
  };

  // Through `stillToCome`, so the beat and the tag cannot come to two views of
  // whether a meeting has happened: the day itself is the meeting still to come
  // rather than one held.
  if (stillToCome(interview, today)) return [arranged];

  return [
    arranged,
    {
      on: heldOn,
      beat: {
        kind: "event",
        what: `You interviewed — ${stage}`,
        when: dayOf(heldOn),
      },
    },
  ];
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
