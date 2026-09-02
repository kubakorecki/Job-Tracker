import type { JobStatus } from "@repo/schema";
import React from "react";

/** How each Status is written wherever it is shown — a badge, a form, a column heading. */
export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  bookmarked: "Bookmarked",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const COLORS: Record<JobStatus, string> = {
  bookmarked:
    "ui:bg-neutral-100 ui:text-neutral-700 dark:ui:bg-neutral-800 dark:ui:text-neutral-300",
  applied:
    "ui:bg-blue-100 ui:text-blue-700 dark:ui:bg-blue-900/40 dark:ui:text-blue-300",
  interviewing:
    "ui:bg-amber-100 ui:text-amber-700 dark:ui:bg-amber-900/40 dark:ui:text-amber-300",
  offer:
    "ui:bg-green-100 ui:text-green-700 dark:ui:bg-green-900/40 dark:ui:text-green-300",
  rejected:
    "ui:bg-red-100 ui:text-red-700 dark:ui:bg-red-900/40 dark:ui:text-red-300",
  withdrawn:
    "ui:bg-neutral-100 ui:text-neutral-500 dark:ui:bg-neutral-800 dark:ui:text-neutral-400",
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span
      className={`ui:inline-flex ui:items-center ui:rounded-full ui:px-2.5 ui:py-0.5 ui:text-xs ui:font-medium ${COLORS[status]}`}
    >
      {JOB_STATUS_LABELS[status]}
    </span>
  );
}
