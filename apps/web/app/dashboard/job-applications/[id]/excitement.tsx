"use client";

import { EXCITEMENT_SCALE } from "@repo/schema";
import { useState } from "react";

/**
 * How much the user wants this one, nought to five, rated in flames.
 *
 * Flames rather than stars because the app already speaks in temperature — a
 * silence goes cold, `ember` is one of the four accents — so a heat rating
 * belongs to the system instead of being borrowed from every other rating
 * control on the internet.
 *
 * Colour is never the only carrier: the line beside the row says the rating in
 * words, and each flame is a button that names its own value.
 *
 * Pressing the flame already lit puts it out, which is how a rating gets back
 * to nothing — where every Job Application starts, and where an accidental
 * click has to be able to return it.
 */
export function Excitement({
  value,
  onChange,
}: {
  /** The rating as the form holds it: the digit, or "" for none. */
  value: string;
  onChange: (excitement: string) => void;
}) {
  // Pointing at a flame previews the rating without committing it, the way any
  // star control does; the committed value comes back on the way out.
  const [previewing, setPreviewing] = useState<number | null>(null);

  const rated = value === "" ? 0 : Number(value);
  const showing = previewing ?? rated;

  return (
    <div
      className="flex items-center"
      onMouseLeave={() => setPreviewing(null)}
      role="group"
      aria-label="How much you want this one, nought to five"
    >
      {EXCITEMENT_SCALE.map((step) => (
        <button
          aria-label={step === 1 ? "One flame" : `${step} flames`}
          aria-pressed={step === rated}
          className={`flex h-9 w-9 items-center justify-center rounded-[7px] hover:bg-paper-sunk ${
            step <= showing ? "text-ember" : "text-line-strong"
          }`}
          key={step}
          onBlur={() => setPreviewing(null)}
          onClick={() => onChange(step === rated ? "" : String(step))}
          onFocus={() => setPreviewing(step)}
          onMouseEnter={() => setPreviewing(step)}
          type="button"
        >
          <Flame lit={step <= showing} />
        </button>
      ))}

      <span
        // The rating in words, which is the reading. It changes as the user
        // points at a flame, so it is announced when it settles rather than
        // once per pixel of travel.
        aria-live="polite"
        className="ml-2.5 text-[12.5px] leading-[1.4] text-ink-muted"
      >
        {SAYS[showing]}
      </span>
    </div>
  );
}

/**
 * What each rating means in words. Nought is a rating too — it is where every
 * Job Application starts, and "not rated" would be about the control rather
 * than about the job.
 */
const SAYS = [
  "Not rated.",
  "Not fussed.",
  "Worth a punt.",
  "Mildly keen.",
  "Would be pleased.",
  "Really want this one.",
];

/**
 * The one icon in the app that fills: 24px grid, 1.7px stroke, and the same
 * shape whether it is lit or not, so a rating of three reads as three of five
 * rather than as three of nothing.
 */
function Flame({ lit }: { lit: boolean }) {
  return (
    <svg
      aria-hidden="true"
      fill={lit ? "currentColor" : "none"}
      height="24"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
      width="24"
    >
      <path d="M12 2.6c3.5 3.6 5.6 6.4 5.6 9.8a5.6 5.6 0 1 1-11.2 0c0-2.1.8-3.9 2.1-5.4.3 1.4 1 2.3 1.9 2.8C9.7 7.2 10.4 4.8 12 2.6Z" />
    </svg>
  );
}
