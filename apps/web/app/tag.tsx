/**
 * A rectangle with a word in it, for the axis that is not Status.
 *
 * Deliberately a different shape from `StatusBadge`'s pill. Status is what the
 * user set; a tag is what happened to them — a silence that has run on, a
 * Posting that is about to stop taking applications — and the two sit side by
 * side on the same card. If they shared a shape they would read as one axis
 * with too many values, which is the confusion the whole design is arranged to
 * avoid (`docs/design-system.md`).
 */

/**
 * How loudly a tag is said. The two that ask something of the user take an
 * accent and a fill; the two that are simply reporting take the page's own
 * line and ink; and `ghosted` is the one that breaks its own outline, because
 * an absence should look like a thing wearing off rather than a thing
 * alarming you.
 */
export type TagTone = "plain" | "quiet" | "cold" | "ghosted" | "urgent";

const TONES: Record<TagTone, string> = {
  plain: "border-line text-ink-faint",
  quiet: "border-line-strong text-ink-muted",
  cold: "border-ember bg-ember-tint text-ember font-semibold",
  ghosted: "border-dashed border-ink-faint text-ink-muted font-semibold",
  urgent: "border-rose bg-rose-tint text-rose font-semibold",
};

export function Tag({
  tone,
  title,
  children,
}: {
  tone: TagTone;
  /** The sentence the few words on the face of it abbreviate. */
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex h-[19px] shrink-0 items-center rounded-tag border px-[7px] text-[10.5px] leading-none font-medium whitespace-nowrap ${TONES[tone]}`}
      title={title}
    >
      {children}
    </span>
  );
}
