import type { Interview, JobApplication, StatusChange } from "@repo/schema";
import { dayInZone } from "../day";
import { fallsIn, monthOfInstant, type Month } from "./month";
import { dayInWords, WORDING, type Language } from "./wording";

/**
 * A month of the user's job search, proposed from what the record holds.
 *
 * It is the whole of the Activity Report's arithmetic and none of its page:
 * given a month, the Job Applications and their Status Changes, it answers
 * with the rows the office's form wants, and the user finishes the document by
 * hand from there (`CONTEXT.md`). Nothing here reads the clock and nothing
 * here is stored — a report is generated for a month, edited, printed, and
 * remembered only by the office.
 *
 * What goes in a row is settled by what actually happened, never by where a
 * Job Application stands today: `status` is not read at all. An employer's
 * refusal belongs to the month it arrived in, and the column that says where
 * the card sits now cannot say when it got there — which is the whole reason
 * Status Changes exist (ADR-0010).
 *
 * Three kinds of Status Change are deliberately silent here:
 *
 * - **`bookmarked`** is not a contact with anybody. Saving a Job Application
 *   records a Status Change like any other move, so a bookmark saved this
 *   month has one, and a report made from it would list a job the user only
 *   looked at as a job they applied for.
 * - **`applied`** is read from `applied_at` instead. The two can disagree, and
 *   the day the user corrected is the true one (ADR-0010).
 * - **`interviewing`** is the answer to an invitation the Interview already
 *   records (ADR-0011). Printing it too would report one invitation twice on
 *   the ordinary path, where the user recorded the meeting and said yes to the
 *   prompt that offered to move the Status.
 *
 * So a Job Application whose only September event was a move to Interviewing
 * gets no row, and the user adds one by hand if they want it — which is what
 * added rows are for. The alternative, a row saying `Brak odpowiedzi` against
 * a month in which somebody plainly did answer, would be a worse lie than an
 * omission the user can see is missing.
 */

/** As much of a Job Application as a row is made from. */
export type Reportable = Pick<
  JobApplication,
  "id" | "company" | "jobTitle" | "location" | "source" | "jobUrl" | "appliedAt"
> & { interviews: readonly Interview[] };

/**
 * One row of the office's form: the three columns, and the Posting's address
 * beside the first of them.
 *
 * The link is its own field rather than a line of `employer` so that it can be
 * shortened on the sheet and still be a real link in the PDF — a URL inside a
 * block of text is either the whole two hundred characters or not a link at
 * all. Every field here is the user's to edit, including the link.
 */
export type ReportRow = {
  /**
   * The Job Application this came from, or an id made up for a row the user
   * added. It addresses a row through an edit and a deletion, and it is in the
   * stored draft, so a row keeps its identity across a reload.
   */
  id: string;
  /** Column 1: the employer, the job, where it is, where it came from. */
  employer: string;
  /** The Posting's address, or empty where there is no Posting. */
  link: string;
  /** Column 2: what the user did, one line per thing, in the order it happened. */
  did: string;
  /** Column 3: what came back, or that nothing did. */
  back: string;
};

/** A month's report, as it is generated and then as the user edits it. */
export type ActivityReport = {
  month: Month;
  language: Language;
  rows: ReportRow[];
  /** The free block under the table, which prints only when it says something. */
  notes: string;
};

/** What the report is proposed from. */
export type ReportInput = {
  month: Month;
  language: Language;
  /** The zone the month's boundaries are counted in: the browser's own. */
  zone: string;
  jobApplications: readonly Reportable[];
  /** Every Status Change the page read, of every Job Application. */
  statusChanges: readonly StatusChange[];
};

/** How many contacts a month is supposed to hold. The office's number. */
export const MONTHLY_MINIMUM = 3;

export function activityReportFor({
  month,
  language,
  zone,
  jobApplications,
  statusChanges,
}: ReportInput): ActivityReport {
  const moves = movesByJobApplication(statusChanges, month, zone);

  const proposed = jobApplications
    .map((jobApplication) =>
      rowFor(jobApplication, moves.get(jobApplication.id) ?? [], {
        month,
        language,
        zone,
      }),
    )
    .filter((row): row is Proposed => row !== null);

  // In the order the month's first event happened. `sort` is stable, so two
  // Job Applications whose months opened on the same day keep the order the
  // page read them in, which is the board's own.
  return {
    month,
    language,
    rows: [...proposed]
      .sort((one, other) => byDay(one.opened, other.opened))
      .map(({ row }) => row),
    notes: "",
  };
}

/** Whether the month falls short of what the office asks for. */
export function shortOfContacts(report: Pick<ActivityReport, "rows">): boolean {
  return report.rows.length < MONTHLY_MINIMUM;
}

/** A row, with the day of the month's first event it is placed by. */
type Proposed = { opened: string; row: ReportRow };

/** One thing that happened, and the day it happened on. */
type Entry = { on: string; said: string };

/**
 * One Job Application's row, or `null` where the month holds nothing to say
 * about it. A row exists exactly where there is something to print in one of
 * the two columns — not wherever a Status Change happens to fall, which is
 * what the three silent Statuses above are about.
 */
function rowFor(
  jobApplication: Reportable,
  moves: readonly Moved[],
  { month, language, zone }: Pick<ReportInput, "month" | "language" | "zone">,
): Proposed | null {
  const words = WORDING[language];
  const { appliedAt, interviews } = jobApplication;

  const did: Entry[] = [];
  const back: Entry[] = [];

  // The CV going out, on the day the user says it went rather than the day
  // they got round to moving the card (ADR-0010). It is an instant, so it is
  // read in the user's own zone like every other instant here.
  if (appliedAt !== null) {
    const applied = dayInZone(appliedAt, zone);
    if (fallsIn(applied, month)) did.push({ on: applied, said: words.applied });
  }

  for (const meeting of interviews) {
    // The invitation and the meeting are two things the employer and the user
    // did, and they routinely fall in different months — which is the whole
    // reason an Interview carries both days (`CONTEXT.md`).
    if (fallsIn(meeting.arrangedOn, month)) {
      back.push({ on: meeting.arrangedOn, said: words.invited });
    }

    // A meeting that was called off was never held, so there is nothing the
    // user did to report. The invitation above stands, because arranging it
    // was still something the employer did.
    if (!meeting.cancelled && fallsIn(meeting.heldOn, month)) {
      did.push({
        on: meeting.heldOn,
        said: words.interviewHeld(meeting.stage),
      });
    }
  }

  for (const move of moves) {
    if (move.status === "withdrawn")
      did.push({ on: move.on, said: words.withdrawn });
    if (move.status === "offer") back.push({ on: move.on, said: words.offer });
    if (move.status === "rejected")
      back.push({ on: move.on, said: words.rejected });
  }

  if (did.length === 0 && back.length === 0) return null;

  return {
    opened: earliest([...did, ...back]),
    row: {
      id: jobApplication.id,
      employer: employerOf(jobApplication, language),
      link: jobApplication.jobUrl ?? "",
      did: cellOf(did, language),
      // A month that brought nothing back says so, rather than leaving a cell
      // the office would read as an oversight.
      back: back.length === 0 ? words.nothingBack : cellOf(back, language),
    },
  };
}

/** Column 1: the employer, the job, and how the user came by it. */
function employerOf(jobApplication: Reportable, language: Language): string {
  const words = WORDING[language];
  const { company, jobTitle, location, source } = jobApplication;

  return [
    company,
    jobTitle,
    location,
    source === null ? null : words.source(source),
  ]
    .filter((line): line is string => line !== null && line.trim() !== "")
    .join("\n");
}

/**
 * A column's entries as the cell holds them: one line each, oldest first, every
 * line opening with the day it happened. The month and the year are in the
 * header, so the day says only as much as it has to.
 */
function cellOf(entries: Entry[], language: Language): string {
  return [...entries]
    .sort((one, other) => byDay(one.on, other.on))
    .map((entry) => `${dayInWords(entry.on, language)}: ${entry.said}`)
    .join("\n");
}

/**
 * Two calendar days, oldest first. Written once because both orderings in this
 * file are the same ordering — the rows down the sheet and the lines down a
 * cell are both the month in the order it happened — and two copies would be
 * two chances to sort one of them the other way.
 */
function byDay(one: string, other: string): number {
  return one < other ? -1 : one > other ? 1 : 0;
}

/** The day the month opened on this Job Application. */
function earliest(entries: Entry[]): string {
  return entries.reduce(
    (soonest, entry) => (entry.on < soonest ? entry.on : soonest),
    entries[0]!.on,
  );
}

/** A Status Change that fell inside the month, as the day it fell on. */
type Moved = { status: StatusChange["status"]; on: string };

/**
 * The month's Status Changes, by the Job Application they moved, in the order
 * they happened. Everything outside the month is dropped here rather than at
 * each reading, and so is every Status the report has nothing to say about.
 */
function movesByJobApplication(
  statusChanges: readonly StatusChange[],
  month: Month,
  zone: string,
): Map<string, Moved[]> {
  const moves = new Map<string, Moved[]>();

  for (const change of statusChanges) {
    if (monthOfInstant(change.changedAt, zone) !== month) continue;

    const held = moves.get(change.jobApplicationId) ?? [];
    held.push({ status: change.status, on: dayInZone(change.changedAt, zone) });
    moves.set(change.jobApplicationId, held);
  }

  return moves;
}
