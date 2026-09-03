import type { JobApplication, JobStatus } from "@repo/schema";

/**
 * Narrowing the dashboard's one cached list to what the user is looking for.
 *
 * This is arithmetic over a list, not a query: it runs in the browser against
 * the list the board already holds, which is what makes a keystroke's results
 * immediate and what keeps the board and the results from ever disagreeing.
 * `use-job-applications.ts` records why that single list is the arrangement.
 */

export type JobApplicationFilter = {
  /** What the user has typed, matched against company and job title. */
  search: string;
  /** The one Status the user is looking at, or null for all of them. */
  status: JobStatus | null;
};

/** Everything, in the order it arrived: the dashboard before it is narrowed. */
export const NO_FILTER: JobApplicationFilter = { search: "", status: null };

/**
 * The Job Applications a filter admits, in the order they were given. A search
 * of nothing but whitespace admits everything, which is what makes clearing
 * the box restore the full set.
 */
export function matching(
  jobApplications: JobApplication[],
  { search, status }: JobApplicationFilter,
): JobApplication[] {
  const wanted = search.trim().toLowerCase();

  return jobApplications.filter(
    (jobApplication) =>
      (status === null || jobApplication.status === status) &&
      (wanted === "" || carries(jobApplication, wanted)),
  );
}

/**
 * Company or job title, the two things the user knows a Job Application by
 * before opening it — and the two the card and the table row both show.
 */
function carries(jobApplication: JobApplication, wanted: string): boolean {
  return (
    jobApplication.company.toLowerCase().includes(wanted) ||
    jobApplication.jobTitle.toLowerCase().includes(wanted)
  );
}
