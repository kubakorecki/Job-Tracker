import type { RequirementWithCoverage } from "@repo/schema";
import { fitFractionOf } from "../../lib/coverage/compare";
import {
  BASIS_LABELS,
  fitColour,
  fitDescription,
  fitLabel,
  fitRatio,
  RING_BASIS,
} from "../../lib/coverage/fit-ring";

/**
 * Where the user stands on one Job Application, at a glance: how much of what
 * the Posting insists on their CV answers, as a partially-filled ring with the
 * fraction beside it.
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
      // The ring is a picture and the two numbers beside it are its caption,
      // so the whole thing is announced once, as the sentence it amounts to,
      // rather than as a bare "6 of 8" in a column of them.
      aria-label={fitDescription(fraction, RING_BASIS)}
      className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap"
      role="img"
      // The same sentence for a pointer, since "6 of 8 · Profile" is short
      // enough to want expanding on and long enough to be worth abbreviating.
      title={fitDescription(fraction, RING_BASIS)}
    >
      <Ring ratio={ratio} />
      <span className="font-medium tabular-nums">{fitLabel(fraction)}</span>
      {/* Which CV the fraction is against, on every ring rather than once per
          view: the Tailored CV effort gives some Job Applications a second
          reading and leaves the rest on the Profile, and a heading could then
          only be right about some of the rows under it. */}
      <span className="opacity-60">{BASIS_LABELS[RING_BASIS]}</span>
    </span>
  );
}

/** The circle the arc is drawn on, and the length of a whole turn of it. */
const RADIUS = 8;
const TURN = 2 * Math.PI * RADIUS;

/**
 * The fraction as an arc: a full ring in the page's own grey with as much of
 * it as is covered drawn over the top, from twelve o'clock clockwise.
 *
 * The track is always whole, so an uncovered Requirement is a visible gap
 * rather than a smaller ring — "1 of 8" and "1 of 2" are two very different
 * pieces of news and would otherwise draw nearly the same picture.
 */
function Ring({ ratio }: { ratio: number }) {
  return (
    <svg
      // Told in the label on the whole thing, of which this is the picture.
      aria-hidden="true"
      className="shrink-0"
      height="16"
      viewBox="0 0 20 20"
      width="16"
    >
      <circle
        className="stroke-neutral-200 dark:stroke-neutral-700"
        cx="10"
        cy="10"
        fill="none"
        r={RADIUS}
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
