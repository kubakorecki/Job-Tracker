import type { RequirementWithCoverage } from "@repo/schema";
import { fitFractionOf } from "../../lib/coverage/compare";
import {
  fitColour,
  fitDescription,
  fitRatio,
  fitTally,
  RING_BASIS,
} from "../../lib/coverage/fit-ring";

/**
 * Where the user stands on one Job Application, at a glance: how much of what
 * the Posting insists on their CV answers, as a partially-filled donut with
 * the fraction beside it.
 *
 * One component for the board card and the table row, because the two views
 * are the same pipeline looked at two ways and a ring that differed between
 * them would be a reason to distrust both (story 44).
 *
 * It is handed the Requirements and works the fraction out itself rather than
 * being passed one, so that the ring and the badges on the detail page are
 * reading the same resolved Coverage through the same function — the whole of
 * why that function is pure and lives apart from either (ADR-0004).
 */
export function FitRing({
  requirements,
}: {
  requirements: readonly RequirementWithCoverage[];
}) {
  const fraction = fitFractionOf(requirements);

  // No ring at all where there is no fraction: a Posting that insists on
  // nothing, and one where nothing has been read yet, are unknowns rather than
  // bad fits, and a ring drawn empty would say the opposite (story 48).
  //
  // Nothing at all rather than a word for it, which is what lets both callers
  // leave the question here: the card hides the line this would have been on,
  // and the table is left with an empty cell, and neither has to ask when a
  // fit is unknown.
  if (fraction === null) return null;

  const ratio = fitRatio(fraction);

  return (
    <span
      // The donut is a picture and the numbers beside it are its caption, so
      // the whole thing is announced once, as the sentence it amounts to,
      // rather than as a bare "6/8" in a column of them. The sentence is also
      // where the Basis is named: it is what the fraction was measured
      // against, and the Tailored CV effort will put two different answers
      // side by side (ADR-0004) — the face of the mark has room for the
      // numbers and nothing else.
      aria-label={fitDescription(fraction, RING_BASIS)}
      className="inline-flex shrink-0 items-center gap-1.5 text-[11px] leading-none font-medium text-ink-muted whitespace-nowrap"
      role="img"
      title={fitDescription(fraction, RING_BASIS)}
    >
      <Ring ratio={ratio} />
      {fitTally(fraction)}
    </span>
  );
}

/** The circle the arc is drawn on, and the length of a whole turn of it. */
const RADIUS = 8;
const TURN = 2 * Math.PI * RADIUS;

/**
 * The fraction as an arc: a full ring in the page's own `line-strong` with as
 * much of it as is covered drawn over the top, from twelve o'clock clockwise.
 *
 * The track is always whole, so an uncovered Requirement is a visible gap
 * rather than a smaller ring — "1/8" and "1/2" are two very different pieces
 * of news and would otherwise draw nearly the same picture.
 */
function Ring({ ratio }: { ratio: number }) {
  return (
    <svg
      // Told in the label on the whole thing, of which this is the picture.
      aria-hidden="true"
      className="shrink-0"
      height="15"
      viewBox="0 0 20 20"
      width="15"
    >
      <circle
        cx="10"
        cy="10"
        fill="none"
        r={RADIUS}
        stroke="var(--line-strong)"
        strokeWidth="4"
      />
      <circle
        cx="10"
        cy="10"
        fill="none"
        r={RADIUS}
        stroke={fitColour(ratio)}
        strokeDasharray={TURN}
        strokeDashoffset={TURN * (1 - ratio)}
        strokeWidth="4"
        // Round ends would put a cap of colour on a fraction of zero, which is
        // the one fraction that has to draw nothing.
        strokeLinecap="butt"
        transform="rotate(-90 10 10)"
      />
    </svg>
  );
}
