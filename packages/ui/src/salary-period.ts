import type { SalaryPeriod } from "@repo/schema";

/**
 * How each salary period is written wherever a salary is edited — the detail
 * view's select, the side panel's review form. It sits beside
 * `REMOTE_TYPE_LABELS` for the same reason: the two surfaces cannot import
 * each other, and a label restated in both drifts.
 *
 * Each label is worded to follow the word "per", which is how both forms
 * introduce the control — "per month" reads as a Posting words it, where
 * "Monthly" beside two numbers does not say what it is monthly about.
 */
export const SALARY_PERIOD_LABELS: Record<SalaryPeriod, string> = {
  annual: "year",
  monthly: "month",
  daily: "day",
  hourly: "hour",
};
