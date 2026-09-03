import type { JobStatus } from "@repo/schema";
import { dayOf } from "../day";

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

export function appliedOn(appliedAt: string | null): string {
  return appliedAt === null ? "Not applied" : dayOf(appliedAt);
}

/**
 * The applied date as an `<input type="date">` holds it, or an empty box when
 * there is none. Sliced in UTC rather than read in the browser's zone, so the
 * day in the box is the day `appliedOn` prints.
 */
export function appliedDateInput(appliedAt: string | null): string {
  return appliedAt === null ? "" : appliedAt.slice(0, 10);
}

/**
 * The reverse: a day the user picked, as the instant the contract stores.
 * Midnight UTC, because a date box says nothing about a time and the tracker
 * has no use for one.
 */
export function appliedAtFromDateInput(day: string): string | null {
  return day === "" ? null : `${day}T00:00:00.000Z`;
}
