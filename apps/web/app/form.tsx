import type { ReactNode } from "react";

/**
 * The pieces every form in this app is built from. They live here rather than
 * in each form so that the add form, the detail view and the settings page
 * cannot drift into three different-looking ways of asking for a name — and so
 * that `packages/ui`, which has to carry its own Tailwind prefix and its own
 * build, stays for what more than one app needs.
 */

export const FIELD =
  "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700";

export const PRIMARY_BUTTON =
  "rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900";

/**
 * A button that reads as a link, for the one thing a message can offer: retry
 * it, clear it, undo it. It inherits its colour, so the same button is legible
 * inside a red failure and on the page.
 */
export const TEXT_BUTTON = "font-medium underline underline-offset-2";

/** A labelled control. The label wraps the control, so the whole of it is a target. */
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex-1 text-sm">
      <span className="mb-1 block opacity-60">{label}</span>
      {children}
    </label>
  );
}

/** Fields side by side where there is room, stacked where there is not. */
export function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 sm:flex-row">{children}</div>;
}

/** Everything the user has to put right before a form will save. */
export function Problems({ problems }: { problems: string[] }) {
  if (problems.length === 0) return null;

  return (
    <ul className="text-sm text-red-600 dark:text-red-400" role="alert">
      {problems.map((problem) => (
        <li key={problem}>{problem}</li>
      ))}
    </ul>
  );
}
