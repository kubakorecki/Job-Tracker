"use client";

import type { JobApplication } from "@repo/schema";
import { StatusBadge } from "@repo/ui/status-badge";
import Link from "next/link";
import { appliedOn } from "../../lib/job-applications/applied-date";

const CELL = "px-3 py-2 align-middle";

/**
 * The columns, in order. Each cell below is written out rather than derived:
 * a company is a link, a Status is a badge, and they have little in common
 * beyond sitting in the same row.
 */
const COLUMNS = ["Company", "Job title", "Location", "Status", "Applied"];

/**
 * The same Job Applications as the board, a row apiece. The board shows the
 * shape of the pipeline; this shows as many Job Applications at once as the
 * screen will hold, which is what makes scanning fifty of them possible.
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
}: {
  jobApplications: JobApplication[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left dark:border-neutral-800">
            {COLUMNS.map((column) => (
              <th className={`${CELL} font-medium`} key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {jobApplications.map((jobApplication) => (
            <tr
              className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-900/50"
              key={jobApplication.id}
            >
              <td className={`${CELL} font-medium`}>
                <Link
                  className="underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  href={`/dashboard/job-applications/${jobApplication.id}`}
                >
                  {jobApplication.company}
                </Link>
              </td>
              <td className={CELL}>{jobApplication.jobTitle}</td>
              <td className={`${CELL} opacity-60`}>
                {jobApplication.location ?? "—"}
              </td>
              <td className={CELL}>
                <StatusBadge status={jobApplication.status} />
              </td>
              <td className={`${CELL} whitespace-nowrap opacity-60`}>
                {appliedOn(jobApplication.appliedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
