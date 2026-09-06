import type { Basis } from "@repo/schema";
import type { FitFraction } from "./compare";

/**
 * What the fit ring says and what colour it runs at. The fraction itself is
 * `fitFractionOf`'s answer (`./compare`) and the drawing is the component's
 * (`app/dashboard/fit-ring.tsx`); everything between the two is here, so that
 * the wording and the colour are testable without rendering anything.
 */

/**
 * How each Basis is named where a reading has to say which CV it is about.
 * Both are worded to follow "your", because the ring says it in a sentence as
 * well as on its face.
 */
export const BASIS_LABELS: Record<Basis, string> = {
  profile: "Profile",
  "tailored-cv": "Tailored CV",
};

/**
 * The Basis the ring draws, which is the only one anything is read against yet
 * — `PROFILE` in `./repository` is the same decision on the storage side, and
 * the Tailored CV effort moves both (ADR-0004).
 *
 * The ring says which Basis it means rather than leaving it understood,
 * because that effort adds a second reading rather than replacing this one:
 * once some Job Applications carry a Tailored CV and others do not, two rings
 * side by side will be about two different CVs, and a ring that never named
 * one would have changed meaning without saying so.
 */
export const RING_BASIS: Basis = "profile";

/**
 * The fraction in words — "6 of 8" — which is what makes the ring legible
 * without being able to tell red from green (story 45).
 *
 * A half is written as one rather than rounded: `partial` counts for half a
 * Requirement, and "6 of 8" where the truth is 5.5 would be the ring claiming
 * a full match the user has not been given. Halves are the only fractions
 * `fitFractionOf` can produce, and they are exact in binary, so this never
 * reads as a run of decimal places.
 */
export function fitLabel({ covered, required }: FitFraction): string {
  return `${covered} of ${required}`;
}

/**
 * How much of what the Posting insists on is covered, between nothing and all
 * of it. The arc and the colour are both drawn from this one number so they
 * cannot describe different fractions.
 */
export function fitRatio({ covered, required }: FitFraction): number {
  return covered / required;
}

/**
 * The colour the arc runs at: red at nothing covered, through amber, to green
 * at all of it, moving with the ratio rather than in steps — a fit that
 * improves by half a Requirement should look slightly better, not identical
 * until it crosses a threshold somebody chose.
 *
 * It is the arc's colour and nothing else's. The fraction beside it is written
 * in the page's own text colour, so nothing on the ring is said in colour
 * alone (story 45); this is reinforcement for a number that is already there
 * to be read.
 *
 * Hue is the whole of what moves. Holding saturation and lightness still is
 * what keeps the arc legible on both the light and the dark background without
 * a second palette to keep in step with the first.
 */
export function fitColour(ratio: number): string {
  return `hsl(${Math.round(120 * ratio)}deg 65% 45%)`;
}

/**
 * The ring read out loud: what the fraction is of, and which CV it was
 * measured against. The ring is a picture with a number beside it, and neither
 * says on its own that the number is about the Requirements this Posting
 * insists on rather than all of them.
 */
export function fitDescription(fraction: FitFraction, basis: Basis): string {
  const requirements = fraction.required === 1 ? "Requirement" : "Requirements";

  return `Fit against your ${BASIS_LABELS[basis]}: ${fitLabel(fraction)} required ${requirements} covered.`;
}
