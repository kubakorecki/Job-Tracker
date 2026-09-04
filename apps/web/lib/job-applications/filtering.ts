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

/**
 * What a dashboard with nothing on it has to say for itself, or `null` when it
 * has something to show and needs to say nothing.
 *
 * The two are not the same news and must not read the same. A user with no Job
 * Applications is being invited to record their first one; a user whose search
 * found nothing has fifty of them and has mistyped a company name, and telling
 * them they have none would be a small lie at the worst moment. Which of the
 * two it is depends on the list before it was narrowed, which is why both go in.
 */
export type Emptiness =
  { kind: "nothing-yet" } | { kind: "nothing-matches"; narrowedBy: NarrowedBy };

/**
 * Which part of the filter is standing between the user and their Job
 * Applications — and so which control the empty state offers to undo. A search
 * of nothing but whitespace does not count, for the same reason `matching`
 * admits everything on one: clearing it would change nothing.
 */
export type NarrowedBy = "search" | "status" | "both";

export function emptiness(
  jobApplications: JobApplication[],
  shown: JobApplication[],
  { search, status }: JobApplicationFilter,
): Emptiness | null {
  if (shown.length > 0) return null;
  if (jobApplications.length === 0) return { kind: "nothing-yet" };

  const searching = search.trim() !== "";

  return {
    kind: "nothing-matches",
    // A view narrowed to nothing was narrowed by something: with neither part
    // of the filter up, `matching` returns the whole list, and the empty case
    // above has already answered.
    narrowedBy:
      searching && status !== null ? "both" : searching ? "search" : "status",
  };
}
