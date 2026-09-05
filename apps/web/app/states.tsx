import type { ReactNode } from "react";
import { TEXT_BUTTON } from "./form";

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
 * `Loading` and `Skeleton` hold no handlers, so a server `loading.tsx` can
 * render them as it stands. `Failure` and `Empty` take something to click and
 * belong inside a client boundary.
 */

/** A grey bar standing in for a line of something that has not arrived. */
export function Skeleton({ className }: { className: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded bg-neutral-200 dark:bg-neutral-800 ${className}`}
    />
  );
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
    <div aria-busy className="flex flex-col gap-4">
      <p className="text-sm opacity-60" role="status">
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
 * `problems` is what the endpoint said, where anything said anything —
 * a server component's error reaches the browser stripped of its message, and
 * there is nothing to add to `what` but the offer to retry.
 */
export function Failure({
  what,
  problems = [],
  onRetry,
}: {
  what: string;
  problems?: string[];
  onRetry: () => void;
}) {
  return (
    <div
      className="flex flex-col items-start gap-2 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
      role="alert"
    >
      <p>Could not load {what}.</p>

      {problems.length > 0 && (
        <ul className="opacity-80">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}

      <button className={TEXT_BUTTON} onClick={onRetry} type="button">
        Try again
      </button>
    </div>
  );
}

/**
 * Nothing here, and what the user can do about it. The invitation is the point:
 * a page that is blank because there is nothing to show reads exactly like one
 * that is blank because something broke.
 */
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-neutral-300 px-6 py-12 text-center dark:border-neutral-700">
      <p className="font-medium">{title}</p>
      {children !== undefined && (
        <div className="flex max-w-md flex-col items-center gap-2 text-sm opacity-70">
          {children}
        </div>
      )}
    </div>
  );
}
