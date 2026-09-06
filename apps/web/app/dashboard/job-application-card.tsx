"use client";

import { useDraggable } from "@dnd-kit/core";
import type { JobApplication } from "@repo/schema";
import { StatusBadge } from "@repo/ui/status-badge";
import Link from "next/link";
import { appliedOn } from "../../lib/job-applications/applied-date";
import { FitRing } from "./fit-ring";

const CARD =
  "rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900";

/**
 * The four things that identify a Job Application without opening it —
 * company, job title, when it was applied for, and where it sits — and, where
 * there is anything to say of it, how much of what the Posting insists on the
 * user has (story 43).
 *
 * The ring is on a line of its own rather than in the row below, which already
 * carries the date and the Status and has a card's width to do it in. A card
 * with no fraction to draw simply does not have the line.
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
      {/* Hidden rather than conditional: whether there is a ring to draw is
          `FitRing`'s own answer, and asking it here would be the second copy
          of a rule about when a fit is unknown. */}
      <div className="mt-2 empty:hidden">
        <FitRing requirements={jobApplication.requirements} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs opacity-60">
          {appliedOn(jobApplication.appliedAt)}
        </span>
        <StatusBadge status={jobApplication.status} />
      </div>
    </div>
  );
}

/**
 * The same card, pickable up — and, since ticket 05, a link through to the
 * detail view. dnd-kit dresses a draggable as a button; here the element is an
 * anchor, so it is told to keep the link role rather than announce itself as a
 * button that cannot be pressed. Clicking still opens the Job Application: the
 * pointer sensor only swallows the click once a drag has actually begun, four
 * pixels of travel later, and the keyboard sensor picks a card up with Space,
 * leaving Enter to follow the link.
 */
export function DraggableJobApplicationCard({
  jobApplication,
}: {
  jobApplication: JobApplication;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: jobApplication.id,
    attributes: { role: "link" },
  });

  return (
    <Link
      // While dragging, the original stays in place as a gap: what follows the
      // cursor is the copy in the overlay.
      className={`cursor-grab touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isDragging ? "opacity-30" : ""}`}
      href={`/dashboard/job-applications/${jobApplication.id}`}
      ref={setNodeRef}
      {...listeners}
      {...attributes}
    >
      <JobApplicationCard jobApplication={jobApplication} />
    </Link>
  );
}
