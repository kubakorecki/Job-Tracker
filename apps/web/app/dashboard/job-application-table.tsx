"use client";

import type { JobApplication, SalaryPeriod } from "@repo/schema";
import { StatusBadge } from "@repo/ui/status-badge";
import Link from "next/link";
import {
  ariaSortOf,
  headingAction,
  SORT_COLUMN_LABELS,
} from "../../lib/dashboard/sort-words";
import type {
  DashboardSort,
  SortColumn,
  SortDirection,
} from "../../lib/dashboard/sorting";
import { ClosingBadge } from "./closing-badge";
import { ExcitementMarks } from "./excitement-marks";
import { FitRing } from "./fit-ring";
import { NextInterviewTag } from "./next-interview-tag";
import { SalaryFigure } from "./salary-figure";
import { SilenceOf } from "./silence-tag";

const CELL = "px-3.5 py-[11px] align-middle";

/**
 * The columns, in order. Each cell below is written out rather than derived:
 * a company is a link, a Status is a badge, and they have little in common
 * beyond sitting in the same row.
 *
 * Fit sits before the Status rather than at the end: scanning down it is the
 * whole reason it is here. Silence follows the Status, and Closes follows
 * Silence — the two axes side by side, and then the one date that says whether
 * either of them still means anything. The next Interview's day is in the
 * Silence cell rather than a column of its own, for the reason given there.
 *
 * Salary follows Location: the two are what the Posting offers, as against
 * how the user fits it and where it stands, and they are read together — the
 * same figure means a different thing in Warsaw and in London. It is the one
 * number in the table that is not the record's own, restated over the period
 * the toolbar reads salaries in, so it sits with the facts about the Posting
 * rather than among the columns the pipeline decided.
 *
 * Applied has gone. The date it showed was being read as "how long have they
 * had this", which is the question Silence answers properly; the date itself
 * is a field on the Job Application's own page.
 *
 * Excitement comes last, after the record rather than inside it. Everything
 * before it is what happened — how well the user fits, where it stands, who
 * has gone quiet, when it shuts. Excitement is the one column that is the
 * user's own opinion, and putting it among the others would have it read as
 * another thing the pipeline decided about them.
 */
const COLUMNS: SortColumn[] = [
  "company",
  "jobTitle",
  "location",
  "salary",
  "fit",
  "status",
  "silence",
  "closes",
  "excitement",
];

/**
 * The same Job Applications as the board, a row apiece. The board shows the
 * shape of the pipeline; this shows as many Job Applications at once as the
 * screen will hold, which is what makes scanning fifty of them possible — and
 * is the release valve for six columns, which stop working around then.
 *
 * A row opens the very same detail view a card does — the company is the link,
 * since a table row cannot be an anchor.
 *
 * Every heading sorts, and the sort is the dashboard's rather than the
 * table's: the rows arrive already in order, so switching to the board and
 * back keeps it, and nothing here orders anything.
 *
 * There is no empty case here. A table of nothing but headings is the wrong
 * answer to both of the reasons a view comes back empty, and the dashboard
 * answers those in one place for the board and the table alike.
 */
export function JobApplicationTable({
  jobApplications,
  period,
  sort,
  onSort,
}: {
  /** In the order `sort` puts them in. */
  jobApplications: JobApplication[];
  /** The Salary Period the Salary column reads salaries in. */
  period: SalaryPeriod;
  sort: DashboardSort;
  /** Told which heading was pressed; what that does to the sort is not ours. */
  onSort: (column: SortColumn) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-panel border border-line bg-paper-raised">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-line bg-paper-sunk text-left">
            {COLUMNS.map((column) => (
              <th
                aria-sort={ariaSortOf(sort, column)}
                className={`${CELL} relative`}
                key={column}
                scope="col"
              >
                <SortHeading
                  column={column}
                  onSort={() => onSort(column)}
                  sort={sort}
                />
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {jobApplications.map((jobApplication) => (
            <tr
              className="border-b border-line last:border-0 hover:bg-paper-sunk"
              key={jobApplication.id}
            >
              <td className={`${CELL} font-semibold`}>
                <Link
                  className="text-ink underline-offset-2 hover:underline"
                  href={`/dashboard/job-applications/${jobApplication.id}`}
                >
                  {jobApplication.company}
                </Link>
              </td>
              <td className={CELL}>{jobApplication.jobTitle}</td>
              <td className={`${CELL} text-ink-faint`}>
                {jobApplication.location ?? "—"}
              </td>
              {/* A dash where no salary is recorded, as Location has: it is a
                  blank the user could fill in. */}
              <td className={`${CELL} whitespace-nowrap`}>
                <SalaryFigure
                  period={period}
                  salary={jobApplication}
                  unrecorded={<span className="text-ink-faint">—</span>}
                />
              </td>
              {/* Empty where there is no fraction, rather than the dash the
                  other columns use for a field nobody filled in: a mark in a
                  column of rings is a verdict, and an unknown fit is not one
                  (story 48). */}
              <td className={CELL}>
                <FitRing requirements={jobApplication.requirements} />
              </td>
              <td className={CELL}>
                <StatusBadge status={jobApplication.status} />
              </td>
              {/* Empty for the same reason the Fit cell is: a fresh Job
                  Application has no silence, which is not a blank the user
                  could fill in.

                  The next Interview's day shares this cell with the silence
                  rather than the Closes cell beside it. It is the same axis —
                  what happened to the user, as against the Status they set —
                  and the two can never both draw, because nothing has gone
                  quiet while a meeting is still in the diary, so neither ever
                  crowds the other out. It shares a cell rather than taking a
                  column of its own because every heading in this table sorts,
                  and a column would be inventing an order nobody asked to read
                  their pipeline in. On a card, where there are no columns, it
                  sits in the marks row beside the Closing. */}
              <td className={CELL}>
                <NextInterviewTag interviews={jobApplication.interviews} />
                <SilenceOf
                  appliedAt={jobApplication.appliedAt}
                  interviews={jobApplication.interviews}
                  status={jobApplication.status}
                  updatedAt={jobApplication.updatedAt}
                />
              </td>
              {/* A dash where no Closing Date is recorded, as Location has:
                  an unrecorded date is a blank the user could fill in, which
                  is not what the empty Fit cell above means. The badge is
                  handed the dash rather than asked whether to draw one, so
                  the cell keeps no opinion of its own about when a Closing
                  Date is missing. */}
              <td className={CELL}>
                <ClosingBadge
                  closesOn={jobApplication.closesOn}
                  status={jobApplication.status}
                  unrecorded={<span className="text-ink-faint">—</span>}
                />
              </td>
              <td className={CELL}>
                <ExcitementMarks excitement={jobApplication.excitement} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A heading as the button that sorts by it. Named for what pressing it does
 * next, since the arrow and the heading's `aria-sort` already say what it is
 * doing now.
 *
 * Only the sorted heading draws its arrow at rest. The rest draw a faint
 * two-way one on hover and on focus — enough to say they can be pressed,
 * without a table that reads as eight arrows. It is hidden rather than absent,
 * so a heading does not widen under the pointer and nudge its neighbours.
 */
function SortHeading({
  column,
  sort,
  onSort,
}: {
  column: SortColumn;
  sort: DashboardSort;
  onSort: () => void;
}) {
  const sorted = ariaSortOf(sort, column);

  return (
    <button
      aria-label={headingAction(sort, column)}
      // The `after` covers the whole heading cell, so the target is the cell
      // rather than a line of 10.5px caps.
      className={`group -mx-1 inline-flex items-center gap-1 rounded-tag px-1 py-0.5 type-eyebrow whitespace-nowrap after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectre ${
        sorted === undefined
          ? "text-ink-faint hover:text-ink-muted"
          : "text-ink"
      }`}
      onClick={onSort}
      type="button"
    >
      {SORT_COLUMN_LABELS[column]}
      <SortArrow direction={sorted} />
    </button>
  );
}

const ARROWS: Record<SortDirection | "either", string> = {
  ascending: "M12 19V5M6 11l6-6 6 6",
  descending: "M12 5v14M6 13l6 6 6-6",
  either: "M8 9.5l4-4 4 4M8 14.5l4 4 4-4",
};

function SortArrow({ direction }: { direction: SortDirection | undefined }) {
  return (
    <svg
      aria-hidden="true"
      className={
        direction === undefined
          ? "invisible text-ink-faint group-hover:visible group-focus-visible:visible"
          : ""
      }
      fill="none"
      height="11"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="11"
    >
      <path d={ARROWS[direction ?? "either"]} />
    </svg>
  );
}
