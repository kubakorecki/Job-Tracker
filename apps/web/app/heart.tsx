/**
 * The Excitement rating's glyph, drawn once for the two places it appears: the
 * control on a Job Application's own page and the read-only marks in the
 * table.
 *
 * A heart rather than the flame this used to be. The flame was an outline with
 * its middle coloured in, and filling it read as a blot rather than as a
 * rating; a heart is a solid shape to begin with, so a rating of three reads
 * as three of five at any size.
 *
 * It is the one icon in the app that fills — every other one is a stroke in
 * `currentColor` with no fill at all, the ghost's eyes aside. The stroke is
 * scaled against the size so the outline of an unlit heart weighs the same
 * 1.5px in a 13px table cell as it does in the 22px control.
 */

const BODY =
  "M12 20.8C12 20.8 3.8 15.6 3.8 9.9A4.6 4.6 0 0 1 12 7.1a4.6 4.6 0 0 1 8.2 2.8c0 5.7-8.2 10.9-8.2 10.9Z";

export function Heart({ size, filled }: { size: number; filled: boolean }) {
  return (
    <svg
      // Always decoration: everywhere the mark appears the words beside it —
      // or the label on the whole row of them — say the same thing, and a
      // column of hearts announcing themselves one at a time would be reading
      // out the furniture.
      aria-hidden="true"
      fill={filled ? "currentColor" : "none"}
      height={size}
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={(1.5 * 24) / size}
      viewBox="0 0 24 24"
      width={size}
    >
      <path d={BODY} />
    </svg>
  );
}
