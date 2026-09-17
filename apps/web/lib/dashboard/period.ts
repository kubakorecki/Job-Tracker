import { SalaryPeriod } from "@repo/schema";

/**
 * The Salary Period the dashboard reads salaries in, and what a remembered
 * choice reads as when it comes back.
 *
 * It lives in browser storage beside the view, for the view's reason: it is how
 * this user likes to read their pipeline, not part of the address of anything.
 */

export const DASHBOARD_PERIOD_KEY = "job-tracker:dashboard-salary-period";

/**
 * Where a user with no stored preference starts. Month, because it is the
 * period most of the Postings this tracker was built around quote in, and a
 * monthly figure is the one a person budgets by.
 */
export const DEFAULT_PERIOD: SalaryPeriod = "monthly";

/**
 * A stored value as a Salary Period. Anything that is not one is the default
 * rather than an error the user has to clear their storage to escape.
 */
export function periodFrom(stored: string | null): SalaryPeriod {
  const period = SalaryPeriod.safeParse(stored);
  return period.success ? period.data : DEFAULT_PERIOD;
}
