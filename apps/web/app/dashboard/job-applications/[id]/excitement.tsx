"use client";

import { EXCITEMENT_SCALE } from "@repo/schema";
import { useState } from "react";
import {
  excitementSays,
  excitementStepLabel,
} from "../../../../lib/job-applications/excitement";
import { Heart } from "../../../heart";
import { Problems } from "../../../form";

/**
 * How much the user wants this one, nought to five, rated in hearts — why a
 * heart and not the flame this used to draw is `app/heart.tsx`. `rose` rather
 * than the `ember` the rest of the temperature language runs at: this is what
 * the user wants, not how long anybody has been quiet.
 *
 * Colour is never the only carrier: the line beside the row says the rating in
 * words, and each heart is a button that names its own value.
 *
 * Pressing the heart already lit puts it out, which is how a rating gets back
 * to nothing — where every Job Application starts, and where an accidental
 * click has to be able to return it.
 *
 * It saves as it is set, as the Coverage override does: `onChange` persists
 * it, the rating shown is whatever the form is holding, and a refusal arrives
 * back as `problems` beside the hearts — which is where the user is looking,
 * and not the top of a form they did not submit.
 *
 * There is no in-flight state on the hearts. A rating is one press and the
 * press is the feedback; greying five buttons out for the length of a request
 * would make the fastest thing on the page feel like the slowest.
 */
export function Excitement({
  value,
  onChange,
  problems,
}: {
  /** The rating as the form holds it: the digit, or "" for none. */
  value: string;
  onChange: (excitement: string) => void;
  /** What went wrong with the last press, in the words the endpoint used. */
  problems: string[];
}) {
  // Pointing at a heart previews the rating without committing it, the way any
  // star control does; the committed value comes back on the way out.
  const [previewing, setPreviewing] = useState<number | null>(null);

  const rated = value === "" ? 0 : Number(value);
  const showing = previewing ?? rated;

  return (
    <div className="flex flex-col gap-2.5">
      <div
        aria-label="How much you want this one, nought to five"
        className="flex items-center"
        onMouseLeave={() => setPreviewing(null)}
        role="group"
      >
        {EXCITEMENT_SCALE.map((step) => (
          <button
            aria-label={excitementStepLabel(step)}
            aria-pressed={step === rated}
            className={`flex h-9 w-9 items-center justify-center rounded-[7px] hover:bg-paper-sunk ${
              step <= showing ? "text-rose" : "text-line-strong"
            }`}
            key={step}
            onBlur={() => setPreviewing(null)}
            onClick={() => onChange(step === rated ? "" : String(step))}
            onFocus={() => setPreviewing(step)}
            onMouseEnter={() => setPreviewing(step)}
            type="button"
          >
            <Heart filled={step <= showing} size={22} />
          </button>
        ))}

        <span
          // The rating in words, which is the reading. It changes as the user
          // points at a heart, so it is announced when it settles rather than
          // once per pixel of travel.
          aria-live="polite"
          className="ml-2.5 text-[12.5px] leading-[1.4] text-ink-muted"
        >
          {excitementSays(showing)}
        </span>
      </div>

      <Problems problems={problems} />
    </div>
  );
}
