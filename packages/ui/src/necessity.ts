import type { Necessity } from "@repo/schema";

/**
 * How each Necessity is written wherever Requirements are shown — the detail
 * view's grouped section, the side panel's read-only list. It sits beside
 * `JOB_STATUS_LABELS` and `REMOTE_TYPE_LABELS` for the same reason: the two
 * surfaces cannot import each other, and a label restated in both drifts.
 *
 * `unstated` reads as what it is about the Posting rather than about the
 * skill — the Posting named it and did not say how badly it wanted it, which
 * is a fact about the wording and not a judgement on the Requirement.
 */
export const NECESSITY_LABELS: Record<Necessity, string> = {
  required: "Required",
  preferred: "Preferred",
  unstated: "Not stated",
};
