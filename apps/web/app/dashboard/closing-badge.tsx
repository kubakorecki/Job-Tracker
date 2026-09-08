import type { JobApplication } from "@repo/schema";
import type { ReactNode } from "react";
import { todayInUtc } from "../../lib/day";
import {
  closingLabel,
  closingOf,
  closingDescription,
  type ClosingKind,
} from "../../lib/job-applications/closing";
import { Tag, type TagTone } from "../tag";

/**
 * When a Posting stops taking applications, and what that means today: a
 * Closing Date the user still has to act on, one they have let pass, or an
 * intake that closed while they were waiting to hear (ADR-0007).
 *
 * One component for the board card, the table row and the detail view, for the
 * same reason there is one fit ring: a Closing that read one way on a card and
 * another on the page behind it would be a reason to trust neither.
 *
 * It wears the same rectangle as the silence tag, and on a card it takes that
 * one slot when there is no silence to report — the two are the same kind of
 * news, a clock running somewhere the user is not, and both are shaped apart
 * from the Status pill for it.
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
    // The date itself and what follows from it — which the four words on the
    // face of the tag have no room for.
    <Tag title={closingDescription(closing)} tone={TONES[closing.kind]}>
      {closingLabel(closing)}
    </Tag>
  );
}

/**
 * How each reading is dressed. Only the two that ask something of the user
 * raise their voice, and they raise it in `rose` — a date running out is the
 * one clock in the app the user can still beat. The other two are the page's
 * own line and ink, because a Closing the user has already acted on is a fact
 * rather than a warning.
 *
 * Colour is reinforcement in every case: `closingLabel` says the whole of it
 * in words, so nothing here is legible only to a reader who can tell rose from
 * grey.
 */
const TONES: Record<ClosingKind, TagTone> = {
  open: "quiet",
  "closing-soon": "urgent",
  missed: "urgent",
  closed: "plain",
};
