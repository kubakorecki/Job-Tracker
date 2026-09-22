/**
 * Whether the dashboard leaves off the Job Applications that are over, and what
 * a remembered choice reads as when it comes back.
 *
 * Remembered where the other filters are not: a search or a Status is a
 * question asked for a moment, while putting the closed ones out of sight is
 * how a user whose hunt has run for months likes to see it every time.
 */

export const DASHBOARD_HIDE_CLOSED_KEY = "job-tracker:dashboard-hide-closed";

/**
 * A stored value as the choice. Only a stored `"true"` hides anything, so a
 * user with no stored preference — or something unrecognised stored — sees
 * every Job Application they have.
 */
export function hideClosedFrom(stored: string | null): boolean {
  return stored === "true";
}
