"use client";

import { Coverage, type RequirementWithCoverage } from "@repo/schema";
import Link from "next/link";
import { FIELD, Problems } from "../../../form";

/**
 * How one Requirement reads against the user's CV, why it reads that way, and
 * the place the user overrules it.
 *
 * The three readings are all shown rather than only the winning one, because a
 * badge that surprises its reader is worth nothing if it cannot be questioned:
 * "Missing" against a skill the user knows they have is the automatic
 * comparison failing to see past a spelling, and seeing that it was the
 * automatic comparison talking is what tells them to run an Analysis or say so
 * themselves (ADR-0004).
 *
 * The override sits in that same panel, on the line where the user's own word
 * is reported. Overruling a verdict is something a person does having just
 * read why it says what it does, so the control belongs where the reasons are
 * rather than as a fifth thing on a row that already holds four.
 *
 * The badge and the readings are two components rather than one that holds its
 * own disclosure, because they sit in two places: the badge belongs on the
 * row, beside the controls that edit the Requirement, and the readings belong
 * under it, across the whole width, where they neither stretch the badge nor
 * push the row's controls out of line with its neighbours'.
 */

/**
 * A Requirement as far as either of these cares: what it asks for, and how it
 * reads. Its id is left out because a row the user has just typed has none
 * yet, and neither the badge nor the readings has any use for one — what an id
 * addresses is the write, and the write is the page's business.
 */
type ReadRequirement = Omit<RequirementWithCoverage, "id">;

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
  requirement: ReadRequirement;
  /** The panel this badge opens, so that the two are announced as a pair. */
  readingsId: string;
  showing: boolean;
  onToggle: () => void;
}) {
  // A verdict the user set says so on its face. Told in a word rather than by
  // a colour or an outline alone, because "I decided this" and "the tool
  // decided this" is the difference the whole override exists to make, and it
  // has to survive being read out loud as readily as being looked at.
  const yours = requirement.overriddenCoverage !== null;

  return (
    <button
      aria-controls={readingsId}
      aria-expanded={showing}
      // The badge is one of a column of them, so the word on its own would be
      // read out as "Missing" with nothing to say what is missing.
      aria-label={`Coverage of ${requirement.skill}: ${coverageLabel(requirement.coverage)}${yours ? ", yours" : ""}. Show what each reading said, and set your own.`}
      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${
        requirement.coverage === null
          ? "border-neutral-300 opacity-60 dark:border-neutral-700"
          : COVERAGE_STYLES[requirement.coverage]
      } ${yours ? "ring-1 ring-current/40" : ""}`}
      onClick={onToggle}
      type="button"
    >
      {coverageLabel(requirement.coverage)}
      {yours && <span className="font-normal opacity-70"> · yours</span>}
    </button>
  );
}

/**
 * What each of the three sources said, whether or not it was the one that won,
 * and the user's own word among them as something they can set.
 */
export function CoverageReadings({
  requirement,
  id,
  override,
}: {
  requirement: ReadRequirement;
  id: string;
  override: Overriding;
}) {
  return (
    <div
      className="flex flex-col gap-1 rounded-md border border-neutral-200 p-2 text-xs dark:border-neutral-800"
      id={id}
    >
      <dl className="flex flex-col gap-0.5">
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
        <div className="flex items-center justify-between gap-3">
          <dt className="opacity-60">Your own</dt>
          <dd>
            {override.onSet === undefined ? (
              <span className="opacity-60">Not set — save the page to say</span>
            ) : (
              <OwnVerdict
                onChange={override.onSet}
                saving={override.saving}
                skill={requirement.skill}
                value={requirement.overriddenCoverage}
              />
            )}
          </dd>
        </div>
      </dl>

      {override.nudging && <Nudge skill={requirement.skill} />}
      <Problems problems={override.problems} />
    </div>
  );
}

/**
 * Everything about the user's own verdict that the panel is not holding
 * itself: whether it can be set at all, whether a change is in flight, what
 * went wrong with the last one, and whether this one earned the nudge. They
 * are one state and arrive as one, rather than as four props that have to be
 * kept consistent by whoever passes them.
 */
export type Overriding = {
  /**
   * Says what the user's own verdict is, or takes it back with `null`. Absent
   * for a Requirement the server has never heard of, which has no row for a
   * verdict to be about yet.
   */
  onSet?: (coverage: Coverage | null) => void;
  saving: boolean;
  problems: string[];
  /**
   * Whether to offer the nudge: the user has just claimed a skill their CV
   * does not show, which is the moment the Profile is worth bringing up to
   * date.
   */
  nudging: boolean;
};

/**
 * Whether saying "I have this" is worth the nudge that follows it. Worth it
 * only where there is a skill list that does not show the skill: claiming
 * something the automatic comparison already found is not news, and a user
 * with no Profile at all is being told to upload one by the section above
 * rather than by a line about a CV they do not have.
 *
 * It lives beside the readings it is about rather than in the row that calls
 * it, because it is a judgement about a Coverage and this is where those are
 * made.
 */
export function worthNudging(
  requirement: ReadRequirement,
  coverage: Coverage | null,
  hasProfileSkills: boolean,
): boolean {
  return (
    coverage === "have" &&
    hasProfileSkills &&
    requirement.normalisedCoverage !== "have"
  );
}

/**
 * The user's own verdict, as the one control that both sets it and takes it
 * back. A select rather than three buttons and a fourth to revert: the four
 * states are one choice with one answer at a time, and "the tracker's reading"
 * is one of the four rather than an undo of the other three — so reverting is
 * the same one choice as making the call, rather than a fourth control that
 * appears only once there is something to undo.
 *
 * It saves on its own, without waiting for the page's Save button. What the
 * user thinks of a verdict is not a correction to what the Posting asked for,
 * and holding it hostage to a form that may also be carrying half-typed text
 * would make the last word the slowest one.
 */
function OwnVerdict({
  value,
  skill,
  saving,
  onChange,
}: {
  value: Coverage | null;
  skill: string;
  saving: boolean;
  onChange: (coverage: Coverage | null) => void;
}) {
  return (
    <select
      // One of a column of them, like the badge, so it says which Requirement
      // it decides.
      aria-label={`Your own verdict on ${skill}`}
      className={`${FIELD} px-2 py-1 text-xs`}
      disabled={saving}
      onChange={(event) =>
        onChange(
          event.target.value === ""
            ? null
            : // Asserted rather than parsed, as the Necessity and Status
              // selects are: the options are built from the contract's own set,
              // and the endpoint parses what arrives before it writes anything.
              (event.target.value as Coverage),
        )
      }
      value={value ?? ""}
    >
      <option value="">Not set — use the reading above</option>
      {Coverage.options.map((coverage) => (
        <option key={coverage} value={coverage}>
          {COVERAGE_LABELS[coverage]}
        </option>
      ))}
    </select>
  );
}

/**
 * What to do about a skill the user has and their CV does not show. An
 * override fixes one Requirement on one Job Application; the CV is what fixes
 * every other Posting that asks for the same thing, now and later, without
 * being asked again (story 42).
 */
function Nudge({ skill }: { skill: string }) {
  return (
    <p className="opacity-70">
      Your CV does not show {skill}.{" "}
      <Link className="underline underline-offset-2" href="/settings/profile">
        Add it to your Profile, or upload a CV that mentions it
      </Link>
      , and every Posting asking for it will read this way on its own.
    </p>
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
