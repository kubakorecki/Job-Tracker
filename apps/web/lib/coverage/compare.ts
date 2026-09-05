import type { Coverage, Necessity } from "@repo/schema";

/**
 * The comparison itself: what a skill list answers of a Posting's Requirements,
 * which of a Requirement's three readings is the Coverage, and what a list of
 * them amounts to as the fraction the fit ring draws.
 *
 * Everything here is arithmetic over values. There is no database access and no
 * model call, which is what lets the badge on the detail page, the ring on the
 * board and the API's own answer come from one function each and so be unable
 * to disagree (ADR-0004).
 */

/**
 * The three readings of one Requirement's Coverage, as a row holds them: each
 * nullable, because null is "this source has not spoken" rather than a verdict
 * of its own.
 *
 * It is a structural shape rather than a named row type so that the Requirement
 * row, the contract's Requirement and anything else carrying the three can be
 * resolved by the same function without being converted first.
 */
export type CoverageReadings = {
  normalisedCoverage: Coverage | null;
  analysedCoverage: Coverage | null;
  overriddenCoverage: Coverage | null;
};

/**
 * What the normalised comparison is able to say. `partial` is deliberately
 * unreachable: a near-miss is a judgement about evidence — four years against a
 * Posting's five — and a string either matches or it does not. Answering
 * `partial` from a comparison would be inventing a doubt it has no way to feel.
 */
export type NormalisedCoverage = Extract<Coverage, "have" | "missing">;

/**
 * Whether an accepted skill list answers one Requirement, with both sides
 * case-folded, emptied of punctuation and symbols, and their whitespace
 * collapsed first. Automatic and free, which is why it is the reading that is
 * always there.
 *
 * Symbols go as well as punctuation, because "C++" and "C#" wear their
 * distinguishing marks in `+` and `#`, and a rule that kept those would be the
 * first entry in the taxonomy this deliberately does not have.
 *
 * The match is of the whole skill and not of part of one: "React" against
 * "React Native" is two skills that share a word, and reading either as the
 * other would be a claim neither the Posting nor the user made.
 *
 * There is no alias table and no taxonomy behind this, by decision — a
 * hand-maintained synonym list would never be complete, and the Analysis is the
 * escape hatch for everything normalisation cannot see. So "Postgres" and
 * "PostgreSQL" read as two skills here, and — the cost of the rule above —
 * "C", "C++" and "C#" read as one. Both are the model's to correct, and the
 * user's to override above that.
 */
export function normalisedCoverageOf(
  asked: string,
  skills: readonly string[],
): NormalisedCoverage {
  const wanted = normalised(asked);

  return skills.some((skill) => normalised(skill) === wanted)
    ? "have"
    : "missing";
}

/**
 * A skill as it is compared rather than as it is written: folded to lower case,
 * emptied of punctuation and symbols, its runs of whitespace collapsed to one
 * space and its edges trimmed.
 *
 * "Node.js", " node-JS " and "NODEJS" are three spellings, and this is the one
 * thing all three have in common.
 *
 * The fold is locale-independent, as every other comparison in this codebase is
 * (`job-applications/filtering.ts`, `schema/near-duplicates.ts`). Under a
 * Turkish locale `toLocaleLowerCase` maps "CI" to "cı", so an ambient locale
 * would decide whether two identical spellings match — a property of whichever
 * host the process happens to run on, and no business of a comparison.
 *
 * Whitespace is collapsed rather than removed, so a space is the one difference
 * this does not fold away: "CI/CD" and "ci cd" stay two skills. Removing it too
 * would fold them together at the cost of folding "front end" into "frontend"
 * and every two-word skill into a run of letters, which is a larger net cast
 * for a smaller catch.
 */
function normalised(skill: string): string {
  return skill
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Which of the three ways of reaching a Coverage produced the one a
 * Requirement reads by: the user's own word, the model's, or the string
 * comparison that is always there.
 */
export type CoverageSource = "override" | "analysis" | "automatic";

/** The column each source speaks through. */
const READING_OF: Record<CoverageSource, keyof CoverageReadings> = {
  override: "overriddenCoverage",
  analysis: "analysedCoverage",
  automatic: "normalisedCoverage",
};

/**
 * The precedence, and the only statement of it: the user's override, then the
 * Analysis, then the normalised comparison (ADR-0004). Both functions below
 * walk this one list, so what a badge says a verdict came from and what it
 * says the verdict is cannot be about two different readings.
 */
const BY_PRECEDENCE: readonly CoverageSource[] = [
  "override",
  "analysis",
  "automatic",
];

/**
 * Who spoke the Coverage a Requirement reads by, or null where none of the
 * three has — the same null `resolvedCoverage` answers with, and for the same
 * reason.
 *
 * It is a question of its own because the interface asks it: a verdict from
 * the Analysis is worth marking as one, both because the user paid for it and
 * because it is the one that can go out of date. Answering it by testing the
 * columns at the badge would be a second copy of the precedence order living
 * where nobody would think to change it.
 */
export function coverageSource(
  readings: CoverageReadings,
): CoverageSource | null {
  return (
    BY_PRECEDENCE.find((source) => readings[READING_OF[source]] !== null) ??
    null
  );
}

/**
 * The one Coverage a Requirement's three readings amount to: the user's
 * override, then the Analysis, then the normalised comparison, and null when
 * none of the three has spoken — a user with no Profile has nothing read about
 * them, which is not the same as everything being missing.
 *
 * Resolving on read rather than on write is what keeps the losing readings
 * available to the affordance that explains a surprising badge, and what makes
 * re-running an Analysis unable to destroy an override (ADR-0004).
 */
export function resolvedCoverage(readings: CoverageReadings): Coverage | null {
  const spoke = coverageSource(readings);

  return spoke === null ? null : readings[READING_OF[spoke]];
}

/**
 * How much of what a Posting insists on the user has, as the ring's two
 * numbers. `covered` may be a half, so it is not always whole; `required` is at
 * least one wherever a fraction exists at all, so the ring can divide by it.
 */
export type FitFraction = {
  /** `have` counted as one and `partial` as a half, added up. */
  covered: number;
  /** How many Requirements the Posting insists on — every one of them. */
  required: number;
};

/** What each Coverage is worth to the fraction. */
const WORTH_BY_COVERAGE: Record<Coverage, number> = {
  have: 1,
  partial: 0.5,
  missing: 0,
};

/**
 * The fraction the fit ring draws, or null where there is no fraction to draw.
 *
 * Only `required` Requirements are counted: a long list of nice-to-haves must
 * not drag down a job the user is well suited to, and a gap in one is not the
 * news a gap in a hard requirement is. `partial` counts for a half, so that a
 * near-miss is neither ignored nor treated as a full match.
 *
 * Null rather than zero is the answer wherever there is nothing to say — a
 * Posting that asks nothing, one that insists on nothing, and one where not one
 * required Requirement has been read yet, which is what a user who has not
 * uploaded a CV has everywhere. Zero is a bad fit and absent is an unknown one,
 * and a ring cannot show the difference, so it is not asked to: it is drawn
 * only when there is a fraction.
 *
 * Once anything has been read the denominator is every required Requirement,
 * read or not. A Requirement with no reading contributes nothing, which is what
 * a `missing` one contributes too — deliberately, because the alternative is a
 * denominator that shrinks to whatever happens to have been read, and
 * "1 of 3" where the Posting insists on eight things overstates the fit and
 * hides the five it dropped. The unread state is momentary anyway: a normalised
 * reading is recomputed for every Requirement whenever they or the Profile's
 * skills change.
 */
export function fitFractionOf(
  requirements: readonly (CoverageReadings & { necessity: Necessity })[],
): FitFraction | null {
  const insisted = requirements.filter(
    ({ necessity }) => necessity === "required",
  );
  const read = insisted
    .map((requirement) => resolvedCoverage(requirement))
    .filter((coverage) => coverage !== null);

  if (read.length === 0) return null;

  return {
    covered: read.reduce(
      (total, coverage) => total + WORTH_BY_COVERAGE[coverage],
      0,
    ),
    required: insisted.length,
  };
}
