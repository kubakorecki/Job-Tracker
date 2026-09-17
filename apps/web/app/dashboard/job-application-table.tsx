"use client";

import type { JobApplication, SalaryPeriod } from "@repo/schema";
import { StatusBadge } from "@repo/ui/status-badge";
import Link from "next/link";
import { ClosingBadge } from "./closing-badge";
import { ExcitementMarks } from "./excitement-marks";
import { FitRing } from "./fit-ring";
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
 * either of them still means anything.
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
const COLUMNS = [
  "Company",
  "Job title",
  "Location",
  "Salary",
  "Fit",
  "Status",
  "Silence",
  "Closes",
  "Excitement",
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
 * There is no empty case here. A table of nothing but headings is the wrong
 * answer to both of the reasons a view comes back empty, and the dashboard
 * answers those in one place for the board and the table alike.
 */
export function JobApplicationTable({
  jobApplications,
  period,
}: {
  jobApplications: JobApplication[];
  /** The Salary Period the Salary column reads salaries in. */
  period: SalaryPeriod;
}) {
  return (
    <div className="overflow-x-auto rounded-panel border border-line bg-paper-raised">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-line bg-paper-sunk text-left">
            {COLUMNS.map((column) => (
              <th
                className={`${CELL} type-eyebrow text-ink-faint`}
                key={column}
                scope="col"
              >
                {column}
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
                  could fill in. */}
              <td className={CELL}>
                <SilenceOf
                  appliedAt={jobApplication.appliedAt}
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
