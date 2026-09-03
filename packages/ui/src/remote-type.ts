import type { RemoteType } from "@repo/schema";

/**
 * How each remote type is written wherever it is offered — the detail view's
 * select, the side panel's review form. It sits beside `JOB_STATUS_LABELS`
 * for the same reason: the two surfaces cannot import each other, and a label
 * restated in both drifts.
 */
export const REMOTE_TYPE_LABELS: Record<RemoteType, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On site",
};
