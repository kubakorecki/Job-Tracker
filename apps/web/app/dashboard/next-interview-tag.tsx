import type { JobApplication } from "@repo/schema";
import { todayInUtc } from "../../lib/day";
import {
  nextInterview,
  nextInterviewDescription,
  nextInterviewLabel,
} from "../../lib/interviews/reading";
import { Tag } from "../tag";

/**
 * The day the user is next in a room with somebody, on the board card and the
 * table row — the one thing about a recruitment that is worth knowing without
 * opening it.
 *
 * It wears the silence tag's rectangle, because it belongs to that axis: a
 * meeting still to come is not something the user set, it is something that
 * happened to them, and it is the reason there is no silence to report while it
 * stands (ADR-0011). It takes the page's own line and ink rather than an
 * accent: it asks nothing of the user, and the two accents a tag can take here
 * are for a clock running out and a wait going cold. Colour would also be the
 * one thing it could not carry honestly — `ember` is the Interviewing Status's,
 * and the Status pill is the only thing in this system that carries a Status's
 * colour (`docs/design-system.md`).
 *
 * It never appears beside a silence tag, by construction rather than by
 * arrangement: `silenceOf` reports nothing at all while a meeting stands.
 *
 * Nothing at all where no meeting is arranged, or where every one of them is
 * behind the user — and nothing for a meeting that was called off. A dash
 * would be wrong here for the reason the fit ring draws none: an empty diary is
 * the ordinary state of a job application rather than a blank the user forgot
 * to fill in.
 */
export function NextInterviewTag({
  interviews,
}: Pick<JobApplication, "interviews">) {
  const today = todayInUtc();
  const next = nextInterview(interviews, today);

  if (next === null) return null;

  return (
    // Which stage it is, the whole date including the year, and how far off it
    // is — none of which the three words on the face of the tag have room for.
    <Tag title={nextInterviewDescription(next, today)} tone="quiet">
      {nextInterviewLabel(next, today)}
    </Tag>
  );
}
