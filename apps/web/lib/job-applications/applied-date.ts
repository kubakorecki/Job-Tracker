import type { JobStatus } from "@repo/schema";

/**
 * What a Job Application's applied date reads as after a move to `status`.
 *
 * Moving to `applied` stamps the date when it is currently unset; every other
 * move — a step backwards, or an outcome like `rejected` or `withdrawn` —
 * leaves it exactly as it was, so reaching an outcome never erases when the
 * user applied.
 *
 * The server enforces this rule inside the update statement itself
 * (`updateJobApplication`), where no read can sit between the check and the
 * write. This is its client-side twin, and exists only so that an optimistic
 * move renders a date rather than "Not applied" on the card the user has just
 * dropped into Applied.
 */
export function appliedAtAfterMove(
  appliedAt: string | null,
  status: JobStatus,
): string | null {
  if (status !== "applied" || appliedAt !== null) return appliedAt;
  return new Date().toISOString();
}

/**
 * A fixed locale and time zone rather than the reader's: a Job Application can
 * be rendered on the server and again on the client, and a date that changes
 * with the machine would be a different date in each.
 */
const APPLIED_ON = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export function appliedOn(appliedAt: string | null): string {
  return appliedAt === null
    ? "Not applied"
    : APPLIED_ON.format(new Date(appliedAt));
}
