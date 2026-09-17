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
import {
  JobStatus,
  type JobApplication,
  type SalaryPeriod,
} from "@repo/schema";
import { JOB_STATUS_LABELS } from "@repo/ui/status-badge";
import { useMemo, useState } from "react";
import {
  DraggableJobApplicationCard,
  JobApplicationCard,
} from "./job-application-card";
import type { Move } from "./use-job-applications";

/**
 * The pipeline as six columns, each an equal share of the page rather than a
 * fixed width — the board is a picture of a process, and a column that is
 * wider because it is fuller would be a picture of something else.
 *
 * The Job Applications arrive already narrowed by the dashboard's toolbar, out
 * of the one cached list, and are grouped here in the browser — so a card
 * dropped into another column is a change to that one list rather than a
 * second thing to keep in step with it.
 *
 * Dropping a card reports the move upwards rather than making it here: the
 * move outlives this component, which the user can unmount by switching to the
 * table while the request is still in flight.
 */
export function Board({
  jobApplications,
  period,
  onMove,
}: {
  jobApplications: JobApplication[];
  /** The Salary Period each card's salary line reads in. */
  period: SalaryPeriod;
  onMove: (move: Move) => void;
}) {
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

    onMove({ id: jobApplication.id, status });
  }

  return (
    <DndContext
      accessibility={{ announcements: announcementsFor(find) }}
      collisionDetection={closestCorners}
      onDragCancel={() => setDraggingId(null)}
      onDragEnd={onDragEnd}
      onDragStart={({ active }) => setDraggingId(String(active.id))}
      sensors={sensors}
    >
      {/* Six columns wherever there is room for six, and a sideways scroll
          where there is not — the shape of the pipeline is the whole of what
          this view is for, and stacking it would make it a list.

          The four pixels of padding either side are the room each column's
          drop zone bleeds into: it is pulled out by `-mx-1` below so the cards
          line up with the rule above them, and without somewhere for the last
          column's to go it overflowed by exactly that much and left the board
          scrolling sideways on a screen with room to spare. The matching
          `-mx-1` here puts the columns back on the page's own gutter, so
          nothing moves but the scrollbar. */}
      <div className="-mx-1 overflow-x-auto px-1 pb-2">
        <div className="grid min-w-[980px] grid-cols-6 items-start gap-3.5">
          {JobStatus.options.map((status) => (
            <Column
              jobApplications={columns[status]}
              key={status}
              period={period}
              status={status}
            />
          ))}
        </div>
      </div>

      {/* What follows the cursor, so the card stays legible in flight. It is
          lifted with a ring rather than a shadow: there is no shadow anywhere
          in this system, and the one place a card has to look picked up is the
          one place a border is not enough. */}
      <DragOverlay>
        {dragging === undefined ? null : (
          <div className="w-64 cursor-grabbing rounded-card ring-2 ring-spectre">
            <JobApplicationCard jobApplication={dragging} period={period} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

/**
 * The two columns nothing leaves. Their headings drop to `ink-faint`, because
 * a pipeline is read left to right and these are where it stops — they are
 * still part of the picture, and no longer part of the work.
 */
const TERMINAL: ReadonlySet<JobStatus> = new Set(["rejected", "withdrawn"]);

function Column({
  status,
  jobApplications,
  period,
}: {
  status: JobStatus;
  jobApplications: JobApplication[];
  period: SalaryPeriod;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      aria-label={JOB_STATUS_LABELS[status]}
      className="flex min-w-0 flex-col gap-[9px]"
    >
      <div className="flex items-baseline justify-between gap-1.5 border-b-[1.5px] border-line-strong pb-[7px]">
        <h3
          className={`type-eyebrow ${TERMINAL.has(status) ? "text-ink-faint" : "text-ink-muted"}`}
        >
          {JOB_STATUS_LABELS[status]}
        </h3>
        <span className="text-[11px] leading-none font-medium text-ink-faint">
          {jobApplications.length}
        </span>
      </div>

      {/* The padding is always there and only the fill arrives, so a card being
          dragged over a column does not nudge every other column's contents. */}
      <div
        className={`-mx-1 flex min-h-16 flex-col gap-2 rounded-card p-1 transition-colors ${
          isOver ? "bg-spectre-tint" : ""
        }`}
        ref={setNodeRef}
      >
        {jobApplications.map((jobApplication) => (
          <DraggableJobApplicationCard
            jobApplication={jobApplication}
            key={jobApplication.id}
            period={period}
          />
        ))}
      </div>
    </section>
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
