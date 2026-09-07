import type { RequirementWithCoverage } from "@repo/schema";
import {
  fitBreakdownOf,
  fitSegments,
  fitSentence,
  type FitSegment,
} from "../../../../lib/coverage/fit-banner";

/**
 * Where the user stands on this one Job Application, said at the top of the
 * page in the display face and in a sentence — the first thing on the left
 * column, above the Requirements it is a summary of.
 *
 * It is the board's ring in a place that has room for it. The fraction is the
 * same fraction, resolved through the same function (ADR-0004); what the page
 * adds is the sentence and one bar per Requirement, so the user can see that
 * "5 of 8" is four outright and two halves rather than five of anything.
 *
 * Nothing here is said in colour alone: the sentence carries the whole reading
 * in words, and the meter is reinforcement under it.
 */
export function FitBanner({
  requirements,
}: {
  requirements: readonly RequirementWithCoverage[];
}) {
  const breakdown = fitBreakdownOf(requirements);

  // Nothing where there is nothing to say — a Posting that insists on nothing,
  // and one nothing has been read against. The same silence the ring keeps, so
  // a card that draws no ring never sits under a page that claims a fit.
  if (breakdown === null) return null;

  return (
    <section className="flex flex-wrap items-center gap-5 rounded-panel border border-line bg-paper-raised px-5 py-[18px]">
      <span className="font-display text-[42px] leading-none tracking-[-0.01em] text-ink">
        {breakdown.covered}
        <span className="text-[26px] text-ink-faint">
          /{breakdown.required}
        </span>
      </span>

      <div className="min-w-[240px] flex-1">
        <p className="text-[13px] leading-[1.5] text-ink-muted">
          {fitSentence(breakdown)}
        </p>

        <div
          // The sentence above says the whole of it; this is a picture of the
          // same sentence and is announced as one thing or not at all.
          aria-hidden="true"
          className="mt-2.5 flex gap-[3px]"
        >
          {fitSegments(breakdown).map((segment, at) => (
            <span
              className={`h-1.5 flex-1 rounded-[2px] ${SEGMENTS[segment]}`}
              key={`${segment}-${at}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * The bar for each reading. `missing` is drawn faintly rather than in full
 * rose: the meter is a picture of what the user has, and a row of loud red
 * blocks would make a fit of five out of eight look like a failure.
 */
const SEGMENTS: Record<FitSegment, string> = {
  have: "bg-vital",
  partial: "bg-ember",
  missing: "bg-rose/35",
  unread: "bg-line-strong",
};
