import type { Necessity } from "@repo/schema";
import { resolvedCoverage, type CoverageReadings } from "./compare";

/**
 * The fit, as the top of a Job Application page says it: the fraction the
 * board's ring draws, written out as a sentence, and drawn as one bar per
 * Requirement rather than as an arc.
 *
 * It is the same reading as the ring's and not a second one — both resolve
 * their Coverage through `resolvedCoverage` and both count only what the
 * Posting insists on (ADR-0004) — but the page has room to say where the
 * halves came from and how many are still unread, which is what a card-sized
 * "5/8" has to leave out.
 *
 * Arithmetic and wording only, so the sentence can be tested without rendering
 * a page.
 */

/**
 * The required Requirements sorted into the four things one can be. `covered`
 * is the ring's numerator, carried here rather than recomputed at the banner
 * so a bar chart and a sentence about it cannot come out of two sums.
 */
export type FitBreakdown = {
  have: number;
  /** Counted as a half each — a near-miss is neither ignored nor a match. */
  partial: number;
  missing: number;
  /** Read by none of the three sources yet. */
  unread: number;
  /** Every Requirement the Posting insists on, read or not. */
  required: number;
  /** `have` plus half of `partial`. */
  covered: number;
};

/**
 * How this Job Application reads, or null where there is nothing to say — a
 * Posting that insists on nothing, and one where not one required Requirement
 * has been read, which is what a user with no Profile has everywhere.
 *
 * Null in exactly the cases `fitFractionOf` answers null, so the banner and
 * the ring appear and disappear together rather than the page claiming a fit
 * the board declines to draw.
 */
export function fitBreakdownOf(
  requirements: readonly (CoverageReadings & { necessity: Necessity })[],
): FitBreakdown | null {
  const insisted = requirements.filter(
    ({ necessity }) => necessity === "required",
  );
  if (insisted.length === 0) return null;

  const breakdown: FitBreakdown = {
    have: 0,
    partial: 0,
    missing: 0,
    unread: 0,
    required: insisted.length,
    covered: 0,
  };

  for (const requirement of insisted) {
    const coverage = resolvedCoverage(requirement);

    if (coverage === null) breakdown.unread += 1;
    if (coverage === "have") breakdown.have += 1;
    if (coverage === "partial") breakdown.partial += 1;
    if (coverage === "missing") breakdown.missing += 1;
  }

  if (breakdown.unread === breakdown.required) return null;

  breakdown.covered = breakdown.have + breakdown.partial / 2;

  return breakdown;
}

/**
 * The fit in a sentence, addressed to the user: what their Profile answers, of
 * how many, and — where the number is not whole — which of the two readings
 * put the halves in it.
 *
 * The whole of it and none of it are worded rather than counted. "3 of the 3
 * things" is arithmetic where the news is that there is nothing missing, and
 * "0 of the 4" reads as a broken counter rather than as a verdict.
 *
 * What is still unread is a second sentence, not a clause of the first. It is
 * news about the app rather than about the fit — the fraction above it is
 * measured against everything the Posting insists on, so an unread Requirement
 * is already counted against the user and they are owed the reason.
 */
export function fitSentence(breakdown: FitBreakdown): string {
  const { have, partial, unread, required, covered } = breakdown;
  const things = required === 1 ? "the one thing" : `the ${required} things`;

  const answers =
    covered === required
      ? `Your Profile answers everything this Posting insists on.`
      : covered === 0
        ? `Your Profile answers none of ${things} this Posting insists on.`
        : `Your Profile answers ${covered} of ${things} this Posting insists on${
            partial === 0 ? "" : ` — ${have} outright, ${partial} in part`
          }.`;

  if (unread === 0) return answers;

  const many =
    unread === 1 ? "One of them has" : `${inWords(unread)} of them have`;

  return `${answers} ${many} not been read yet.`;
}

/**
 * The one carrier the meter is: the required Requirements as a row of bars,
 * best first, so the eye reads the shape of the fit before it reads the
 * number. Colour is never the only thing saying it — `fitSentence` stands
 * beside every one of these.
 */
export type FitSegment = "have" | "partial" | "missing" | "unread";

export function fitSegments(breakdown: FitBreakdown): FitSegment[] {
  const order: FitSegment[] = ["have", "partial", "missing", "unread"];

  return order.flatMap((segment) =>
    Array.from({ length: breakdown[segment] }, () => segment),
  );
}

/**
 * A small count as a word, because it opens a sentence and a numeral there
 * reads as a list item. Only the counts a sentence of this shape can carry —
 * past a dozen unread Requirements the numeral is the clearer thing anyway.
 */
function inWords(count: number): string {
  const WORDS = [
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
  ];

  return WORDS[count - 2] ?? String(count);
}
