import { EXCITEMENT_SCALE } from "@repo/schema";
import { excitementDescription } from "../../lib/job-applications/excitement";
import { Heart } from "../heart";

/**
 * How much the user wants one Job Application, as a mark rather than a
 * control: the same five hearts the detail page rates in, at the size a table
 * row has for them, and not pressable. A rating is set on the Job
 * Application's own page, where the words beside the row say what each step
 * means.
 *
 * All five are always drawn, as the fit ring always draws its whole track: a
 * rating of one and a rating of five would otherwise be two hearts and five
 * hearts, which are the same picture at different lengths, and there would be
 * nothing on screen saying what the rating is out of.
 *
 * A dash where nobody has rated it, as Location and Closes use for a field
 * nobody filled in — an unrated Job Application is a blank the user could
 * fill, which is a different piece of news from the empty Fit cell beside it.
 */
export function ExcitementMarks({ excitement }: { excitement: number | null }) {
  if (excitement === null) {
    return <span className="text-ink-faint">—</span>;
  }

  return (
    <span
      // The row of hearts is one picture and its label is the whole caption:
      // the fraction, and what that fraction means in words. Announced heart
      // by heart it would be five decorations and no reading (story 45).
      aria-label={excitementDescription(excitement)}
      className="inline-flex shrink-0 items-center gap-[3px] whitespace-nowrap"
      role="img"
      title={excitementDescription(excitement)}
    >
      {EXCITEMENT_SCALE.map((step) => (
        <span
          className={step <= excitement ? "text-rose" : "text-line-strong"}
          key={step}
        >
          <Heart filled={step <= excitement} size={13} />
        </span>
      ))}
    </span>
  );
}
