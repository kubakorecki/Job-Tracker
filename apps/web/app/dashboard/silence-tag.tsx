import type { JobApplication } from "@repo/schema";
import { todayInUtc } from "../../lib/day";
import {
  silenceDescription,
  silenceLabel,
  silenceOf,
  type Silence,
  type SilenceKind,
} from "../../lib/job-applications/silence";
import { Tag, type TagTone } from "../tag";

/**
 * How long it has been since anybody said anything. Nothing at all for the
 * first week: a job applied for on Monday has not gone quiet by Friday, and a
 * tag on every card would be noise rather than news.
 *
 * The reading itself is `silenceOf`'s, and this is only what it looks like.
 * The tag is drawn as a rectangle rather than a pill because Status is the
 * other axis and wears the pill — silence is what happened to the user, Status
 * is what they set, and the two sit on the same card.
 */
export function SilenceTag({ silence }: { silence: Silence }) {
  return (
    <Tag title={silenceDescription(silence)} tone={TONES[silence.kind]}>
      {silenceLabel(silence)}
    </Tag>
  );
}

/**
 * The same tag, for a caller that has a Job Application rather than a reading
 * — the table row and the detail view, neither of which has any other use for
 * the days. The board's card reads it for itself, because the card fades with
 * the silence as well as labelling it and would otherwise ask twice.
 *
 * It is handed the four fields a silence is made of rather than a whole Job
 * Application, for the reason `ClosingBadge` is handed two: nothing above it
 * can then pair a wait with Interviews it did not come from, and every surface
 * counts the days through the one function.
 */
export function SilenceOf({
  status,
  appliedAt,
  updatedAt,
  interviews,
}: Pick<JobApplication, "status" | "appliedAt" | "updatedAt" | "interviews">) {
  const silence = silenceOf(
    { status, appliedAt, updatedAt, interviews },
    todayInUtc(),
  );

  if (silence === null) return null;

  return <SilenceTag silence={silence} />;
}

/**
 * The ladder, in colour. It climbs to ember and then stops climbing: a ghosted
 * Job Application is quieter than a cold one rather than louder, because
 * ghosting is an absence and not an error. Colour is never the only carrier —
 * `silenceLabel` says the reading and the count in words on every one of them.
 */
const TONES: Record<SilenceKind, TagTone> = {
  quiet: "quiet",
  cold: "cold",
  ghosted: "ghosted",
};
