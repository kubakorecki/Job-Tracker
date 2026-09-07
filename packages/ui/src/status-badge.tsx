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

/**
 * A tint fill under the accent itself, one per Status. The four accents share
 * a lightness and a chroma and differ only in hue, so no Status wins an
 * argument by being brighter than its neighbours.
 *
 * The two that are not on the accent wheel say so by their shape as much as
 * their colour: Bookmarked is the page's own grey because nothing has happened
 * to it yet, and Withdrawn is an outline with nothing inside it.
 */
const TONES: Record<JobStatus, string> = {
  bookmarked: "ui:bg-paper-sunk ui:text-ink-muted",
  applied: "ui:bg-spectre-tint ui:text-spectre",
  interviewing: "ui:bg-ember-tint ui:text-ember",
  offer: "ui:bg-vital-tint ui:text-vital",
  rejected: "ui:bg-rose-tint ui:text-rose",
  withdrawn:
    "ui:bg-transparent ui:text-ink-faint ui:shadow-[inset_0_0_0_1px_var(--line-strong)]",
};

/**
 * Where a Job Application sits, and the only thing in the app that carries
 * Status colour. Silence is the other axis and is drawn as a rectangle
 * (`app/dashboard/silence-tag.tsx`) precisely so the two never read as one:
 * Status is what the user set, and silence is what happened to them.
 */
export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span
      className={`ui:inline-flex ui:h-[22px] ui:shrink-0 ui:items-center ui:rounded-full ui:px-2.5 ui:text-[10.5px] ui:font-semibold ui:tracking-[0.02em] ui:whitespace-nowrap ${TONES[status]}`}
    >
      {JOB_STATUS_LABELS[status]}
    </span>
  );
}
