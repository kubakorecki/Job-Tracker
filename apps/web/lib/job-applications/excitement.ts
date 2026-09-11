import { EXCITEMENT_SCALE } from "@repo/schema";

/**
 * What a rating says, kept apart from the hearts that draw it — the control on
 * the detail page (`app/dashboard/job-applications/[id]/excitement.tsx`) and
 * the read-only mark in the table (`app/dashboard/excitement-marks.tsx`) are
 * two pictures of one reading, and the words are stated once so they cannot
 * come apart. Why it is a heart at all is `app/heart.tsx`.
 *
 * Colour is never the only carrier: the reading is said in words beside the
 * control, and the mark in the table says the whole of it in its label.
 */

/**
 * What each rating means in words. Nought is a rating too — it is where every
 * Job Application starts, and "not rated" would be about the control rather
 * than about the job.
 */
export const EXCITEMENT_SAYS = [
  "Not rated.",
  "Not fussed.",
  "Worth a punt.",
  "Mildly keen.",
  "Would be pleased.",
  "Really want this one.",
] as const;

/** One rating in words, nought included. */
export function excitementSays(rating: number): string {
  return EXCITEMENT_SAYS[rating] ?? EXCITEMENT_SAYS[0];
}

/**
 * What one heart in the row says it would set, because an icon on its own is a
 * picture of a number and not the number. Not the reading — that is
 * `excitementSays`, which is what the user is told the rating means.
 */
export function excitementStepLabel(step: number): string {
  return step === 1 ? "One heart" : `${step} hearts`;
}

/**
 * The mark read out loud: the fraction, then the reading. It is one sentence
 * because the hearts in a table cell are a picture with no caption beside them
 * — a bare "3" in a column of them would say neither what it is out of nor
 * what it means.
 *
 * An unrated Job Application says so rather than reading as nought of five: a
 * rating nobody has given is not the lowest one.
 */
export function excitementDescription(rating: number | null): string {
  if (rating === null) return "Excitement: not rated.";

  return `Excitement: ${rating} of ${EXCITEMENT_SCALE.length}. ${excitementSays(rating)}`;
}
