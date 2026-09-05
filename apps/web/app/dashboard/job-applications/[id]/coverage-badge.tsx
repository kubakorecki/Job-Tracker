"use client";

import type { Coverage, RequirementWithCoverage } from "@repo/schema";

/**
 * How one Requirement reads against the user's CV, and — behind a disclosure —
 * why it reads that way.
 *
 * The three readings are all shown rather than only the winning one, because a
 * badge that surprises its reader is worth nothing if it cannot be questioned:
 * "Missing" against a skill the user knows they have is the automatic
 * comparison failing to see past a spelling, and seeing that it was the
 * automatic comparison talking is what tells them to run an Analysis or say so
 * themselves (ADR-0004).
 *
 * The badge and the readings are two components rather than one that holds its
 * own disclosure, because they sit in two places: the badge belongs on the
 * row, beside the controls that edit the Requirement, and the readings belong
 * under it, across the whole width, where they neither stretch the badge nor
 * push the row's controls out of line with its neighbours'.
 */

/** The three verdicts in the words a person reads them in. */
const COVERAGE_LABELS: Record<Coverage, string> = {
  have: "Have it",
  partial: "Partly",
  missing: "Missing",
};

/**
 * Colour carries the same news as the word, never news of its own — the label
 * is always there to be read, so nothing depends on telling green from red.
 */
const COVERAGE_STYLES: Record<Coverage, string> = {
  have: "border-green-600/40 bg-green-500/10 text-green-800 dark:text-green-300",
  partial:
    "border-amber-600/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  missing: "border-red-600/40 bg-red-500/10 text-red-800 dark:text-red-300",
};

export function CoverageBadge({
  requirement,
  readingsId,
  showing,
  onToggle,
}: {
  requirement: RequirementWithCoverage;
  /** The panel this badge opens, so that the two are announced as a pair. */
  readingsId: string;
  showing: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      aria-controls={readingsId}
      aria-expanded={showing}
      // The badge is one of a column of them, so the word on its own would be
      // read out as "Missing" with nothing to say what is missing.
      aria-label={`Coverage of ${requirement.skill}: ${coverageLabel(requirement.coverage)}. Show what each reading said.`}
      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${
        requirement.coverage === null
          ? "border-neutral-300 opacity-60 dark:border-neutral-700"
          : COVERAGE_STYLES[requirement.coverage]
      }`}
      onClick={onToggle}
      type="button"
    >
      {coverageLabel(requirement.coverage)}
    </button>
  );
}

/** What each of the three sources said, whether or not it was the one that won. */
export function CoverageReadings({
  requirement,
  id,
}: {
  requirement: RequirementWithCoverage;
  id: string;
}) {
  return (
    <dl
      className="flex flex-col gap-0.5 rounded-md border border-neutral-200 p-2 text-xs dark:border-neutral-800"
      id={id}
    >
      <Reading
        label="Automatic comparison"
        unread="Not compared yet"
        value={requirement.normalisedCoverage}
      />
      <Reading
        label="Analysis"
        unread="Not run"
        value={requirement.analysedCoverage}
      />
      {requirement.analysedReason !== null && (
        <dd className="opacity-60">{requirement.analysedReason}</dd>
      )}
      <Reading
        label="Your own"
        unread="Not set"
        value={requirement.overriddenCoverage}
      />
    </dl>
  );
}

/** One source's word, or what it says when that source has not spoken. */
function Reading({
  label,
  value,
  unread,
}: {
  label: string;
  value: Coverage | null;
  unread: string;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="opacity-60">{label}</dt>
      <dd className={value === null ? "opacity-60" : "font-medium"}>
        {value === null ? unread : COVERAGE_LABELS[value]}
      </dd>
    </div>
  );
}

/**
 * What the badge says. A Requirement none of the three has spoken about is not
 * "missing" — it is a Requirement nobody has read yet, which is what a user
 * with no Profile has everywhere, and calling that a gap would be a verdict on
 * a comparison that never happened.
 */
function coverageLabel(coverage: Coverage | null): string {
  return coverage === null ? "Not read" : COVERAGE_LABELS[coverage];
}
