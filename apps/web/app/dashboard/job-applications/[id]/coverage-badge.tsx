"use client";

import { Coverage, type RequirementWithCoverage } from "@repo/schema";
import Link from "next/link";
import {
  coverageSource,
  type CoverageSource,
} from "../../../../lib/coverage/compare";
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
 *
 * Both are told whether the Analysis has gone stale, and neither decides it:
 * `stale` is what the endpoint answered (`analysis/staleness.ts`), so the
 * greyed verdict here and the banner above the section cannot come to disagree
 * about a Job Application the user can no longer act on.
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
 * What a badge says about where its verdict came from, after the verdict
 * itself. Where a Coverage comes from is `coverageSource`'s answer, never a
 * test of the columns here (ADR-0004).
 *
 * The automatic comparison is marked with nothing. It is the reading that is
 * always there, so a word for it would sit on almost every badge and single
 * out nothing; the two that are worth naming are the one the user made and the
 * one they spent a model call on.
 */
const SOURCE_MARKERS: Record<CoverageSource, string | null> = {
  override: "yours",
  analysis: "analysed",
  automatic: null,
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
  stale,
  onToggle,
}: {
  requirement: ReadRequirement;
  /** The panel this badge opens, so that the two are announced as a pair. */
  readingsId: string;
  showing: boolean;
  /** Whether the Analysis this badge may be speaking for has gone out of date. */
  stale: boolean;
  onToggle: () => void;
}) {
  // Which of the three is talking. A verdict the user set says so on its face,
  // and so does one the model reached: told in a word rather than by a colour
  // or an outline alone, because "I decided this", "the model decided this"
  // and "a string comparison decided this" are three different weights of
  // claim, and each has to survive being read out loud as readily as being
  // looked at.
  const spoke = coverageSource(requirement);
  const marker = spoke === null ? null : SOURCE_MARKERS[spoke];

  // Only a verdict the Analysis is speaking for can be out of date. The user's
  // own word stands until they take it back, and the automatic comparison is
  // recomputed whenever either side of it moves, so greying either would be
  // casting doubt on a reading that is current.
  const outOfDate = stale && spoke === "analysis";

  return (
    <button
      aria-controls={readingsId}
      aria-expanded={showing}
      // The badge is one of a column of them, so the word on its own would be
      // read out as "Missing" with nothing to say what is missing.
      aria-label={`Coverage of ${requirement.skill}: ${coverageLabel(requirement.coverage)}${marker === null ? "" : `, ${marker}`}${outOfDate ? ", out of date" : ""}. Show what each reading said, and set your own.`}
      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${
        requirement.coverage === null
          ? "border-neutral-300 opacity-60 dark:border-neutral-700"
          : COVERAGE_STYLES[requirement.coverage]
      } ${spoke === "override" ? "ring-1 ring-current/40" : ""} ${
        // Greyed rather than hidden or restyled: the verdict is still the one
        // the page is showing, and the colour is what stops speaking for it.
        outOfDate ? "opacity-60 grayscale" : ""
      }`}
      onClick={onToggle}
      type="button"
    >
      {coverageLabel(requirement.coverage)}
      {marker !== null && (
        <span className="font-normal opacity-70"> · {marker}</span>
      )}
    </button>
  );
}

/**
 * The model's one line about one Requirement, which is the half of an Analysis
 * a string comparison could never produce: not that something is wrong, but
 * what about the CV made it so.
 *
 * It sits on the row and not behind the disclosure, because it is what the
 * user spent a model call to read — a page of them is the answer to "what do I
 * change?", and an answer that has to be opened one Requirement at a time is
 * one nobody reads twice. It is the only place the reason appears: the panel
 * below says what each source's verdict was, and repeating the line an inch
 * under itself would be noise rather than emphasis.
 */
export function AnalysedReason({
  reason,
  stale,
}: {
  reason: string;
  stale: boolean;
}) {
  return (
    <p className={`text-xs ${stale ? "opacity-40" : "opacity-60"}`}>{reason}</p>
  );
}

/**
 * What each of the three sources said, whether or not it was the one that won,
 * and the user's own word among them as something they can set.
 */
export function CoverageReadings({
  requirement,
  id,
  stale,
  override,
}: {
  requirement: ReadRequirement;
  id: string;
  /** Whether the Analysis's line here is about a CV or a list that has moved on. */
  stale: boolean;
  override: Overriding;
}) {
  const outOfDate = stale && requirement.analysedCoverage !== null;

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
          // Out of date only where there is something to be out of date. A
          // Requirement the last run did not answer about has heard nothing
          // from the Analysis, and "Not run (out of date)" would be a
          // complaint about a verdict nobody gave.
          //
          // A different question from the badge's, which asks whether the
          // verdict on show is the Analysis's: an overridden Requirement reads
          // as the user's word, in full colour, over an analysed reading this
          // line still has to mark as old.
          faded={outOfDate}
          // Said in the label rather than left to the dimming, so that the one
          // thing a stale verdict most needs to carry survives being read out
          // loud as well as being looked at.
          label={outOfDate ? "Analysis (out of date)" : "Analysis"}
          unread="Not run"
          value={requirement.analysedCoverage}
        />
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
  faded = false,
}: {
  label: string;
  value: Coverage | null;
  unread: string;
  /** Whether this source's word no longer describes what it read. */
  faded?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-3 ${faded ? "opacity-50" : ""}`}>
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
