import type { JobApplication } from "@repo/schema";
import { StatusBadge } from "@repo/ui/status-badge";

/**
 * Everything the user has saved, newest first. A row carries the four things
 * that identify a Job Application without opening it: company, job title, when
 * it was applied for, and where it sits.
 */
export function JobApplicationList({
  jobApplications,
}: {
  jobApplications: JobApplication[];
}) {
  if (jobApplications.length === 0) {
    return (
      <p className="text-sm opacity-60">
        Nothing saved yet. Add the first one above.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
      {jobApplications.map((jobApplication) => (
        <li
          className="flex items-center justify-between gap-4 py-3"
          key={jobApplication.id}
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{jobApplication.company}</p>
            <p className="truncate text-sm opacity-60">
              {jobApplication.jobTitle}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-sm opacity-60">
              {appliedOn(jobApplication.appliedAt)}
            </span>
            <StatusBadge status={jobApplication.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * A fixed locale and time zone rather than the reader's: this renders on the
 * server, and a date that changes with the machine would be a different date
 * in the markup than in a later client render.
 */
const APPLIED_ON = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function appliedOn(appliedAt: string | null): string {
  return appliedAt === null
    ? "Not applied"
    : APPLIED_ON.format(new Date(appliedAt));
}
