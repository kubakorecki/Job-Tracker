/**
 * Which of the dashboard's two views the user is looking at, and what a
 * remembered choice reads as when it comes back.
 *
 * The preference lives in browser storage rather than the URL: it is how this
 * user likes to look at their pipeline, not part of the address of anything,
 * so a link to the dashboard should not carry it.
 */

export const DASHBOARD_VIEWS = ["board", "table"] as const;

export type DashboardView = (typeof DASHBOARD_VIEWS)[number];

export const DASHBOARD_VIEW_KEY = "job-tracker:dashboard-view";

/** Where a user with no stored preference starts. */
export const DEFAULT_VIEW: DashboardView = "board";

/**
 * A stored value as a view. Browser storage holds strings, and holds whatever
 * some earlier version of this dashboard put there, so anything that is not
 * one of the two views is the default rather than an error the user has to
 * clear their storage to escape.
 */
export function viewFrom(stored: string | null): DashboardView {
  return DASHBOARD_VIEWS.includes(stored as DashboardView)
    ? (stored as DashboardView)
    : DEFAULT_VIEW;
}
