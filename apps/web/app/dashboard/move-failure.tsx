"use client";

import { JOB_STATUS_LABELS } from "@repo/ui/status-badge";
import { SECONDARY_BUTTON_SMALL } from "../form";
import type { FailedMove } from "./use-job-applications";

/**
 * The explanation behind a card that snapped back. It names the move that
 * failed rather than reading the board, so retrying reattempts that same
 * change however the board has moved on since.
 *
 * It sits above both views rather than inside the board: a move made by
 * dragging can still be in flight when the user switches to the table, and a
 * failure the user cannot see is the silent revert this message exists to
 * prevent.
 *
 * It says plainly what happened and what to press, and nothing else. Nothing
 * here is funny — the card the user dropped is back where it started, and they
 * need to know why rather than to be entertained about it.
 */
export function MoveFailure({
  failed,
  company,
  onRetry,
  onDismiss,
}: {
  failed: FailedMove;
  company: string | undefined;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-rose bg-rose-tint px-4 py-3"
      role="alert"
    >
      <span className="text-[12.5px] leading-[1.55] text-ink-muted">
        <span className="font-semibold text-rose">
          Could not move {company ?? "that Job Application"} to{" "}
          {JOB_STATUS_LABELS[failed.move.status]}.
        </span>{" "}
        {failed.reason}
      </span>
      <button
        className={SECONDARY_BUTTON_SMALL}
        onClick={onRetry}
        type="button"
      >
        Retry
      </button>
      <button
        className={SECONDARY_BUTTON_SMALL}
        onClick={onDismiss}
        type="button"
      >
        Dismiss
      </button>
    </div>
  );
}
