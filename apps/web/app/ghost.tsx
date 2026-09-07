/**
 * The wordmark's own glyph, reused wherever the app needs a mark: 21px beside
 * the wordmark in the bar, 34–40px and dashed in an empty state, 86px and
 * nearly invisible bleeding off the corner of a ghosted card.
 *
 * One path and two eyes, on the 24px grid every other icon in the app is drawn
 * on. The eyes are the single place in the system anything is filled — every
 * other icon is a 1.7px stroke in `currentColor` with no fill at all, and
 * there are no emoji anywhere.
 */

const BODY =
  "M4 21V10a8 8 0 0 1 16 0v11 q-1.6-2.4-3.2 0 q-1.6-2.4-3.2 0 q-1.6-2.4-3.2 0 q-1.6-2.4-3.2 0 q-1.6-2.4-3.2 0 Z";

/**
 * How the mark is drawn, which is a reading rather than a decoration:
 *
 * - `solid` is the mark itself, for the bar and for an invitation.
 * - `dashed` is the mark with its outline broken and its eyes shut, for a view
 *   that came back with nothing in it.
 * - `filled` is the silhouette, which is only ever used at 5% ink bleeding out
 *   of a ghosted card — it is a stain on the paper rather than a picture.
 */
export type GhostDrawing = "solid" | "dashed" | "filled";

export function Ghost({
  size,
  drawing = "solid",
  className,
}: {
  size: number;
  drawing?: GhostDrawing;
  className?: string;
}) {
  return (
    <svg
      // Always decoration: everywhere the mark appears, the words beside it
      // say the same thing, and an empty state that announced "ghost" before
      // its own heading would be reading out the furniture.
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      {drawing === "filled" ? (
        <path d={BODY} fill="currentColor" />
      ) : (
        <>
          <path
            d={BODY}
            stroke="currentColor"
            strokeDasharray={drawing === "dashed" ? "3 3" : undefined}
            strokeLinejoin="round"
            strokeWidth={drawing === "dashed" ? 1.3 : 1.5}
          />
          {/* A dashed ghost has its eyes shut. It stands for a view that found
              nothing, and a face looking back at the user would read as a
              character rather than as an absence. */}
          {drawing === "solid" && (
            <>
              <circle cx="9.2" cy="10.8" fill="currentColor" r="1.15" />
              <circle cx="14.8" cy="10.8" fill="currentColor" r="1.15" />
            </>
          )}
        </>
      )}
    </svg>
  );
}

/**
 * The name, set in the display face. `.boo` drops to `ink-faint` so the mark
 * reads as one word with a quiet tail rather than as two.
 */
export function Wordmark({ size = 23 }: { size?: number }) {
  return (
    <span
      className="font-display leading-none"
      style={{ fontSize: `${size}px` }}
    >
      ghosted<span className="text-ink-faint">.boo</span>
    </span>
  );
}
