"use client";

import { useDraggable } from "@dnd-kit/core";
import type { JobApplication, SalaryPeriod } from "@repo/schema";
import Link from "next/link";
import { todayInUtc } from "../../lib/day";
import {
  silenceOf,
  type SilenceKind,
} from "../../lib/job-applications/silence";
import { Ghost } from "../ghost";
import { ClosingBadge } from "./closing-badge";
import { FitRing } from "./fit-ring";
import { SalaryFigure } from "./salary-figure";
import { SilenceTag } from "./silence-tag";

/**
 * What identifies a Job Application without opening it: the company, the job
 * title, and one line of marks — how much of what the Posting insists on the
 * user has (story 43), and the one thing with a clock on it.
 *
 * Under the job title, what it pays, restated over the period the dashboard
 * reads salaries in — and no line at all where no salary is recorded, so a card
 * without one is no taller for it.
 *
 * No Status badge and no applied date. The column the card is standing in says
 * the Status, and the date has been replaced by something that answers the
 * question the date was being read for: not "when did I send this" but "how
 * long have they had it".
 *
 * Silence and a Closing Date share the one tag slot. They are the same kind of
 * news — a clock running somewhere the user is not — and they cannot both be
 * urgent at once: only a Job Application still waiting can go quiet, and only
 * a bookmarked one can be hurried by a Closing Date (ADR-0007).
 *
 * The card fades toward the page as the silence grows, and never turns red.
 * Ghosting is an absence, not an error.
 */
export function JobApplicationCard({
  jobApplication,
  period,
}: {
  jobApplication: JobApplication;
  /** The Salary Period the salary line reads in. */
  period: SalaryPeriod;
}) {
  const silence = silenceOf(jobApplication, todayInUtc());
  const tone = silence === null ? null : silence.kind;

  return (
    <div
      className={`relative flex flex-col gap-[3px] overflow-hidden rounded-card border px-3 pt-[11px] pb-3 ${TONES[tone ?? "live"]}`}
    >
      {/* The mark bleeding out of the corner of a Job Application nobody is
          going to answer. Five per cent ink: a stain on the paper rather than
          a picture, and the only place the glyph is ever filled in. */}
      {tone === "ghosted" && (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-3.5 -bottom-5 text-ink opacity-5"
        >
          <Ghost drawing="filled" size={86} />
        </span>
      )}

      <span
        className={`truncate text-[13.5px] leading-[1.3] font-semibold ${tone === "ghosted" ? "text-ink-muted" : "text-ink"}`}
      >
        {jobApplication.company}
      </span>
      <span
        className={`truncate text-xs leading-[1.35] ${tone === "ghosted" ? "text-ink-faint" : "text-ink-muted"}`}
      >
        {jobApplication.jobTitle}
      </span>
      {/* Hidden rather than conditional, as the marks row below is: whether
          there is a salary to show is the figure's own answer. */}
      <span
        className={`truncate text-xs leading-[1.35] empty:hidden ${tone === "ghosted" ? "text-ink-faint" : "text-ink-muted"}`}
      >
        <SalaryFigure period={period} salary={jobApplication} />
      </span>

      {/* Hidden rather than conditional: whether there is a ring to draw, and
          whether there is a Closing to name, are each their own component's
          answer, and asking here would be a second copy of both rules. The row
          is empty exactly when all of them drew nothing. */}
      <div className="mt-[7px] flex flex-wrap items-center gap-1.5 empty:hidden">
        <FitRing requirements={jobApplication.requirements} />
        {silence !== null ? (
          <SilenceTag silence={silence} />
        ) : (
          <ClosingBadge
            closesOn={jobApplication.closesOn}
            status={jobApplication.status}
          />
        )}
      </div>
    </div>
  );
}

/**
 * How far a card has faded. `cold` breaks its outline in the accent that goes
 * with the label; `ghosted` lets go of the page entirely — dashed, unfilled,
 * and a step lighter throughout.
 */
const TONES: Record<SilenceKind | "live", string> = {
  live: "border-line bg-paper-raised",
  quiet: "border-line bg-paper-raised",
  cold: "border-dashed border-ember bg-paper-raised",
  ghosted: "border-dashed border-line-strong bg-transparent",
};

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
  period,
}: {
  jobApplication: JobApplication;
  /** The Salary Period the card's salary line reads in. */
  period: SalaryPeriod;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: jobApplication.id,
    attributes: { role: "link" },
  });

  return (
    <Link
      // While dragging, the original stays in place as a gap: what follows the
      // cursor is the copy in the overlay.
      className={`block cursor-grab touch-none rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectre ${isDragging ? "opacity-30" : ""}`}
      href={`/dashboard/job-applications/${jobApplication.id}`}
      ref={setNodeRef}
      {...listeners}
      {...attributes}
    >
      <JobApplicationCard jobApplication={jobApplication} period={period} />
    </Link>
  );
}
