"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { JobStatus, type JobApplication } from "@repo/schema";
import { JOB_STATUS_LABELS } from "@repo/ui/status-badge";
import { useMemo, useState } from "react";
import {
  DraggableJobApplicationCard,
  JobApplicationCard,
} from "./job-application-card";
import {
  useJobApplications,
  useMoveJobApplication,
  type FailedMove,
} from "./use-job-applications";

/**
 * The pipeline as columns. Every Job Application arrives in one cached list
 * and is grouped here, in the browser, so that a card dropped into another
 * column is a change to that one list rather than a second thing to keep in
 * step with it.
 */
export function Board({
  initialJobApplications,
}: {
  initialJobApplications: JobApplication[];
}) {
  const { data: jobApplications } = useJobApplications(initialJobApplications);
  const { failures, move, retry, dismiss } = useMoveJobApplication();
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const columns = useMemo(
    () => groupByStatus(jobApplications),
    [jobApplications],
  );
  const find = (id: string) => jobApplications.find((one) => one.id === id);
  const dragging = draggingId === null ? undefined : find(draggingId);

  const sensors = useSensors(
    // A few pixels of travel before a drag begins, so that a click through to
    // the detail view is not swallowed by the card's drag listeners.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // Space picks a card up; Enter is left to the link on the card, which is
    // how the detail view is reached from the keyboard.
    useSensor(KeyboardSensor, {
      keyboardCodes: {
        start: ["Space"],
        cancel: ["Escape"],
        end: ["Space", "Tab"],
      },
    }),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    setDraggingId(null);
    if (over === null) return;

    const jobApplication = find(String(active.id));
    const status = over.id as JobStatus;
    if (jobApplication === undefined || jobApplication.status === status) {
      return;
    }

    move({ id: jobApplication.id, status });
  }

  return (
    <div className="flex flex-col gap-3">
      {failures.map((failed) => (
        <MoveFailure
          company={find(failed.move.id)?.company}
          failed={failed}
          key={failed.move.id}
          onDismiss={() => dismiss(failed)}
          onRetry={() => retry(failed)}
        />
      ))}

      <DndContext
        accessibility={{ announcements: announcementsFor(find) }}
        collisionDetection={closestCorners}
        onDragCancel={() => setDraggingId(null)}
        onDragEnd={onDragEnd}
        onDragStart={({ active }) => setDraggingId(String(active.id))}
        sensors={sensors}
      >
        <div className="flex gap-3 overflow-x-auto pb-2">
          {JobStatus.options.map((status) => (
            <Column
              jobApplications={columns[status]}
              key={status}
              status={status}
            />
          ))}
        </div>

        {/* What follows the cursor, so the card stays legible in flight. */}
        <DragOverlay>
          {dragging === undefined ? null : (
            <div className="w-64 cursor-grabbing opacity-90 shadow-lg">
              <JobApplicationCard jobApplication={dragging} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({
  status,
  jobApplications,
}: {
  status: JobStatus;
  jobApplications: JobApplication[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      aria-label={JOB_STATUS_LABELS[status]}
      className={`flex w-64 shrink-0 flex-col gap-2 rounded-lg border p-2 transition-colors ${
        isOver
          ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30"
          : "border-neutral-200 dark:border-neutral-800"
      }`}
      ref={setNodeRef}
    >
      <h3 className="flex items-baseline justify-between px-1 text-sm font-medium">
        {JOB_STATUS_LABELS[status]}
        <span className="text-xs opacity-50">{jobApplications.length}</span>
      </h3>

      <div className="flex min-h-24 flex-col gap-2">
        {jobApplications.map((jobApplication) => (
          <DraggableJobApplicationCard
            jobApplication={jobApplication}
            key={jobApplication.id}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * The explanation behind a card that snapped back. It names the move that
 * failed rather than reading the board, so retrying reattempts that same
 * change however the board has moved on since.
 */
function MoveFailure({
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
        className="font-medium underline underline-offset-2"
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

function groupByStatus(
  jobApplications: JobApplication[],
): Record<JobStatus, JobApplication[]> {
  const columns = Object.fromEntries(
    JobStatus.options.map((status) => [status, [] as JobApplication[]]),
  ) as Record<JobStatus, JobApplication[]>;

  for (const jobApplication of jobApplications) {
    columns[jobApplication.status].push(jobApplication);
  }

  return columns;
}

/**
 * What a screen reader hears during a keyboard drag. dnd-kit's own wording
 * reads out the draggable's id, which here is a UUID; a company name and a
 * column heading are what the user actually moved something between.
 */
function announcementsFor(
  find: (id: string) => JobApplication | undefined,
): Announcements {
  const card = (id: string | number) =>
    find(String(id))?.company ?? "Job Application";
  const column = (id: string | number) =>
    JOB_STATUS_LABELS[id as JobStatus] ?? String(id);

  return {
    onDragStart: ({ active }) => `Picked up ${card(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over === null
        ? `${card(active.id)} is not over a column.`
        : `${card(active.id)} is over ${column(over.id)}.`,
    onDragEnd: ({ active, over }) =>
      over === null
        ? `${card(active.id)} was dropped outside the board.`
        : `${card(active.id)} was moved to ${column(over.id)}.`,
    onDragCancel: ({ active }) => `Moving ${card(active.id)} was cancelled.`,
  };
}
