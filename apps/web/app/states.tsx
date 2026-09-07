import type { ReactNode } from "react";
import { SECONDARY_BUTTON_SMALL } from "./form";
import { Ghost, type GhostDrawing } from "./ghost";

/**
 * The three things a page can be other than the thing the user asked for:
 * still on its way, arrived with nothing in it, or not arrived at all. The
 * user has to be able to tell those apart at a glance, and they can only do
 * that if the answer looks the same wherever they are standing — so these live
 * here, beside `form.tsx`, for the same reason its pieces do.
 *
 * Each of them says what to do next where there is anything to do: an empty
 * state invites, and a failure offers to ask again.
 *
 * The voice splits here, and the split is the point. An empty state is where
 * the app is allowed to be dry — nothing has gone wrong and there is nothing
 * to solve. A failure is not: it says plainly what happened, what state things
 * are in now, and what to press.
 *
 * `Loading` and `Skeleton` hold no handlers, so a server `loading.tsx` can
 * render them as it stands. `Failure` and `Empty` take something to click and
 * belong inside a client boundary.
 */

/** A grey bar standing in for a line of something that has not arrived. */
export function Skeleton({ className }: { className: string }) {
  return <div aria-hidden className={`skeleton rounded ${className}`} />;
}

/**
 * A route on its first fetch. The wait is written out as well as drawn: a
 * skeleton is furniture to a screen reader, and this sentence is the whole of
 * what a user who cannot see it gets.
 */
export function Loading({
  what,
  children,
}: {
  what: string;
  children?: ReactNode;
}) {
  return (
    <div aria-busy className="flex flex-col gap-3">
      <p className="type-meta" role="status">
        Loading {what}…
      </p>
      {children}
    </div>
  );
}

/**
 * Something that did not arrive, and the one thing worth offering about it:
 * asking again. A failure that leaves the user with an empty page and no
 * button is indistinguishable from having nothing saved, which is the whole
 * confusion this exists to prevent.
 *
 * `problems` is what the endpoint said, where anything said anything — a
 * server component's error reaches the browser stripped of its message, and
 * there is nothing to add to `what` but the offer to retry.
 *
 * No jokes in this one, and none in anything it wraps. The dry voice is for
 * empty states and silence labels; the moment the user has a problem to solve
 * it stops being funny.
 */
export function Failure({
  what,
  standing,
  problems = [],
  onRetry,
  onDismiss,
}: {
  what: string;
  /**
   * What the user is looking at instead, where they are looking at anything —
   * a failed re-read leaves the last good copy on the board, and a page that
   * did not say so would have the user editing something that may not save.
   */
  standing?: string;
  problems?: string[];
  onRetry: () => void;
  /** Offered only where there is something left standing to go on using. */
  onDismiss?: () => void;
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-card border border-rose bg-rose-tint px-4 py-3.5"
      role="alert"
    >
      <Alert />

      <div className="flex-1">
        <h2 className="text-[13.5px] leading-[1.4] font-semibold text-rose">
          Could not load {what}.
        </h2>

        {standing !== undefined && (
          <p className="mt-1.5 text-xs leading-[1.55] text-ink-muted">
            {standing}
          </p>
        )}

        {problems.length > 0 && (
          <ul className="mt-1.5 text-xs leading-[1.55] text-ink-muted">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}

        <div className="mt-2.5 flex flex-wrap gap-2">
          <button
            className={SECONDARY_BUTTON_SMALL}
            onClick={onRetry}
            type="button"
          >
            Try again
          </button>
          {onDismiss !== undefined && (
            <button
              className={SECONDARY_BUTTON_SMALL}
              onClick={onDismiss}
              type="button"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Nothing here, and what the user can do about it. The invitation is the
 * point: a page that is blank because there is nothing to show reads exactly
 * like one that is blank because something broke.
 *
 * The heading is the display face at 26px and says the whole thing in a
 * sentence — "Nothing out there yet.", "No sign of it." — with the
 * explanation under it in `ink-muted` and at most two quiet buttons below
 * that.
 */
export function Empty({
  title,
  drawing = "dashed",
  children,
}: {
  title: string;
  /**
   * Which ghost stands over it. A dashed one for a view narrowed to nothing,
   * a solid one for a board nothing has been put on yet — the difference
   * between "your filters found none of them" and "there are none".
   */
  drawing?: GhostDrawing;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-card border border-dashed border-line-strong px-7 py-11 text-center">
      <span className="text-ink-faint opacity-60">
        <Ghost drawing={drawing} size={40} />
      </span>
      <h2 className="type-section">{title}</h2>
      {children !== undefined && (
        <div className="flex max-w-[400px] flex-col items-center gap-2.5 text-[13px] leading-[1.6] text-ink-muted">
          {children}
        </div>
      )}
    </div>
  );
}

/** The one icon a failure carries: 24px grid, 1.7px stroke, no fill. */
function Alert() {
  return (
    <svg
      aria-hidden="true"
      className="mt-0.5 shrink-0 text-rose"
      fill="none"
      height="17"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      width="17"
    >
      <path d="M12 8v5" />
      <path d="M12 16.5v.01" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
