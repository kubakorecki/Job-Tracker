"use client";

import { JOB_STATUS_LABELS } from "@repo/ui/status-badge";
import { TEXT_BUTTON } from "../form";
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
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
      role="alert"
    >
      <span>
        Could not move {company ?? "that Job Application"} to{" "}
        {JOB_STATUS_LABELS[failed.move.status]}. {failed.reason}
      </span>
      <button
        className={TEXT_BUTTON}
        onClick={onRetry}
        type="button"
      >
        Retry
      </button>
      <button
        className="opacity-60 underline underline-offset-2"
        onClick={onDismiss}
        type="button"
      >
        Dismiss
      </button>
    </div>
  );
}
