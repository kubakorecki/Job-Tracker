import type { JobApplication } from "@repo/schema";
import type { ReactNode } from "react";
import {
  closingLabel,
  closingOf,
  closingDescription,
  todayInUtc,
  type ClosingKind,
} from "../../lib/job-applications/closing";

/**
 * When a Posting stops taking applications, and what that means today: a
 * Closing Date the user still has to act on, one they have let pass, or an
 * intake that closed while they were waiting to hear (ADR-0007).
 *
 * One component for the board card, the table row and the detail view, for the
 * same reason there is one fit ring: a Closing that read one way on a card
 * and another on the page behind it would be a reason to trust neither.
 *
 * It is handed the two fields the reading is made of rather than a Closing, so
 * that nothing above it can pair a date with a Status it did not come from,
 * and so every surface counts the days through the one function.
 */
export function ClosingBadge({
  closesOn,
  status,
  unrecorded = null,
}: Pick<JobApplication, "closesOn" | "status"> & {
  /**
   * What to render where the Job Application has no Closing Date. Nothing, by
   * default: most Job Applications have none, and a row of dashes across every
   * card would cost more attention than the feature buys. The table passes a
   * dash, because a blank cell in a column of dates reads as an oversight
   * where an unrecorded date is a blank the user could fill in — and it passes
   * one rather than testing for itself, so that whether a Job Application has
   * a Closing Date at all stays this component's single answer.
   */
  unrecorded?: ReactNode;
}) {
  const closing = closingOf({ closesOn, status }, todayInUtc());

  if (closing === null) return unrecorded;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs whitespace-nowrap ${TONES[closing.kind]}`}
      // The date itself and what follows from it — which the four words on the
      // face of the badge have no room for.
      title={closingDescription(closing)}
    >
      {closingLabel(closing)}
    </span>
  );
}

/**
 * How each reading is dressed. Outlined rather than filled, so that a Closing
 * is not mistaken for the Status badge it sits beside — the two say different
 * things and should not look like two of the same thing.
 *
 * Only the two readings that ask something of the user raise their voice:
 * amber for a Closing still worth acting on, red for one that got away. The
 * other two are the page's own grey, because a Closing the user has already
 * acted on is a fact rather than a warning. Colour is reinforcement in every
 * case — `closingLabel` says the whole of it in words, so nothing here is
 * legible only to a reader who can tell amber from grey.
 */
const TONES: Record<ClosingKind, string> = {
  open: "border-neutral-200 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400",
  "closing-soon":
    "border-amber-400 bg-amber-50 font-medium text-amber-800 dark:border-amber-500/60 dark:bg-amber-900/30 dark:text-amber-200",
  missed:
    "border-red-300 font-medium text-red-700 dark:border-red-500/60 dark:text-red-300",
  closed:
    "border-neutral-200 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400",
};
