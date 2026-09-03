"use client";

import { useDraggable } from "@dnd-kit/core";
import type { JobApplication } from "@repo/schema";
import { StatusBadge } from "@repo/ui/status-badge";
import { appliedOn } from "../../lib/job-applications/applied-date";

const CARD =
  "rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900";

/**
 * The four things that identify a Job Application without opening it —
 * company, job title, when it was applied for, and where it sits.
 */
export function JobApplicationCard({
  jobApplication,
}: {
  jobApplication: JobApplication;
}) {
  return (
    <div className={CARD}>
      <p className="truncate font-medium">{jobApplication.company}</p>
      <p className="truncate text-sm opacity-60">{jobApplication.jobTitle}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs opacity-60">
          {appliedOn(jobApplication.appliedAt)}
        </span>
        <StatusBadge status={jobApplication.status} />
      </div>
    </div>
  );
}

/** The same card, pickable up. */
export function DraggableJobApplicationCard({
  jobApplication,
}: {
  jobApplication: JobApplication;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: jobApplication.id,
  });

  return (
    <div
      // While dragging, the original stays in place as a gap: what follows the
      // cursor is the copy in the overlay.
      className={`cursor-grab touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isDragging ? "opacity-30" : ""}`}
      ref={setNodeRef}
      {...listeners}
      {...attributes}
    >
      <JobApplicationCard jobApplication={jobApplication} />
    </div>
  );
}
