"use client";

import { Coverage, type RequirementWithCoverage } from "@repo/schema";
import Link from "next/link";
import {
  coverageSource,
  type CoverageSource,
} from "../../../../lib/coverage/compare";
import {
  CHOSEN_BUTTON_SMALL,
  Problems,
  SECONDARY_BUTTON_SMALL,
} from "../../../form";

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
 *
 * The three sit at one lightness and one chroma and differ only in hue, so
 * `Missing` cannot shout down `Have it` by being the brighter badge. The tint
 * is the fill and the accent is the text, as every reading in the system is
 * drawn (`docs/design-system.md`).
 */
const COVERAGE_STYLES: Record<Coverage, string> = {
  have: "border-vital bg-vital-tint text-vital",
  partial: "border-ember bg-ember-tint text-ember",
  missing: "border-rose bg-rose-tint text-rose",
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
      // A rectangle rather than the Status pill's round: Coverage is a reading
      // about the user, Status is what they set, and the two are never to be
      // read as one axis.
      // The halo is drawn in `currentColor` rather than in one of the four
      // accents, because the badge is a different colour for every Coverage and
      // a fixed hover would be a fifth reading on a control whose whole job is
      // to carry one.
      className={`inline-flex h-6 shrink-0 items-center gap-1.5 rounded-control border px-[9px] text-[11.5px] leading-none font-semibold whitespace-nowrap hover:ring-2 hover:ring-current/30 ${
        requirement.coverage === null
          ? "border-line-strong text-ink-faint"
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
        <span className="text-[10.5px] font-normal opacity-75">· {marker}</span>
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
    // Set off by a rule down its left rather than by a box: it is the model
    // talking about the row above it, which is a quotation and not a panel.
    <p
      className={`max-w-[620px] border-l-2 border-line-strong pl-[11px] text-[12.5px] leading-[1.55] ${
        stale ? "text-ink-faint" : "text-ink-muted"
      }`}
    >
      {reason}
    </p>
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

  // Which of the three the badge above is speaking for, so the ladder can mark
  // it. `coverageSource` again rather than a test of the columns here: the
  // precedence is stated once (ADR-0004) and a second copy of it living in a
  // disclosure panel is a second copy nobody would think to change.
  const spoke = coverageSource(requirement);

  return (
    <div className="flex flex-col gap-2.5 pt-0.5 pb-4" id={id}>
      <dl className="flex flex-col gap-[5px]">
        <Reading
          label="Compared"
          unread="Not compared yet"
          value={requirement.normalisedCoverage}
          wins={spoke === "automatic"}
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
          label={outOfDate ? "Analysed (out of date)" : "Analysed"}
          unread="Not run"
          value={requirement.analysedCoverage}
          wins={spoke === "analysis"}
        />
        <Reading
          label="Yours"
          unread={
            override.onSet === undefined
              ? "Save the page before you can say"
              : "You have not said"
          }
          value={requirement.overriddenCoverage}
          wins={spoke === "override"}
        />
      </dl>

      {override.onSet !== undefined && (
        <OwnVerdict
          onChange={override.onSet}
          saving={override.saving}
          skill={requirement.skill}
          value={requirement.overriddenCoverage}
        />
      )}

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
 * The user's own verdict, as four controls on one line: the three readings and
 * the way back to none of them.
 *
 * Buttons rather than a select, because this is the row of the ladder the user
 * is here to act on. A select puts the four behind a click and reads as one
 * more field on a page already made of them; four small buttons under the
 * three readings say what the panel is for — you have just read why it says
 * what it does, and here is where you overrule it.
 *
 * "Clear" is offered alongside the three rather than only once there is
 * something to undo, so the control keeps its shape as the row changes under
 * the user's hand.
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
    <div
      // One of a column of these, so it says which Requirement it decides.
      aria-label={`Your own verdict on ${skill}`}
      className="flex flex-wrap items-center gap-[7px]"
      role="group"
    >
      <span className="mr-0.5 text-xs text-ink-faint">Set your own:</span>

      {Coverage.options.map((coverage) => (
        <VerdictButton
          chosen={value === coverage}
          disabled={saving}
          key={coverage}
          // Asserted nowhere: the options are the contract's own set, and the
          // endpoint parses what arrives before it writes anything.
          onClick={() => onChange(coverage)}
        >
          {COVERAGE_LABELS[coverage]}
        </VerdictButton>
      ))}

      <VerdictButton
        chosen={false}
        // Nothing to take back, so nothing to press. Left in place rather than
        // hidden, so the row does not reflow as the user makes up their mind.
        disabled={saving || value === null}
        onClick={() => onChange(null)}
      >
        Clear
      </VerdictButton>
    </div>
  );
}

/**
 * One of the four. The chosen one is filled in the page's own ink rather than
 * in an accent: which verdict the user picked is not a fifth reading of the
 * Coverage, and colouring it `vital` or `rose` would put a second, louder copy
 * of the badge inside the panel that explains the badge.
 */
function VerdictButton({
  chosen,
  disabled,
  onClick,
  children,
}: {
  chosen: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-pressed={chosen}
      className={chosen ? CHOSEN_BUTTON_SMALL : SECONDARY_BUTTON_SMALL}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
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
    <p className="text-xs leading-[1.55] text-ink-muted">
      Your CV does not show {skill}.{" "}
      <Link className="underline underline-offset-2" href="/settings/profile">
        Add it to your Profile, or upload a CV that mentions it
      </Link>
      , and every Posting asking for it will read this way on its own.
    </p>
  );
}

/**
 * One rung of the ladder: a source, its word, and whether that word is the one
 * the badge is speaking. The three read as a list in ascending precedence, so
 * a user who is surprised by a badge can see which of the three surprised them
 * (ADR-0004).
 */
function Reading({
  label,
  value,
  unread,
  faded = false,
  wins = false,
}: {
  label: string;
  value: Coverage | null;
  unread: string;
  /** Whether this source's word no longer describes what it read. */
  faded?: boolean;
  /** Whether this is the reading the badge above is showing. */
  wins?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline gap-2.5 text-xs ${faded ? "opacity-50" : ""}`}
    >
      <dt className="w-[74px] shrink-0 font-semibold text-ink-muted">
        {label}
      </dt>
      <dd
        className={
          value === null
            ? "text-ink-faint"
            : wins
              ? "font-semibold text-ink"
              : "text-ink-muted"
        }
      >
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
