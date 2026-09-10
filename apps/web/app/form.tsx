import type { ReactNode } from "react";

/**
 * The pieces every form in this app is built from. They live here rather than
 * in each form so that the add form, the detail view and the settings page
 * cannot drift into three different-looking ways of asking for a name — and so
 * that `packages/ui`, which has to carry its own Tailwind prefix and its own
 * build, stays for what more than one app needs.
 *
 * The numbers are `docs/design-system.md`'s: 34px controls, 28px small, radius
 * 5, and a focus that is a `spectre` border over a three-pixel `spectre-tint`
 * ring. Nothing here dims text with opacity — a tint under a dimmed colour
 * double-dims and cannot be tuned per surface, which is what `ink-muted` and
 * `ink-faint` are for. The one exception is a disabled control, where the
 * whole thing fades rather than the words on it.
 */

/** What a control that is a single line tall stands at. */
export const CONTROL_HEIGHT = "h-[34px]";

/**
 * A box, less its size. Everything that varies between the 34px control, the
 * 28px one and the sign-in page's 40px is left out of it, and each of the
 * constants below states its own.
 *
 * They compose rather than override for a reason worth writing down: Tailwind
 * emits `h-[34px]` after `h-7` and `text-[13px]` after `text-xs`, and
 * utilities of equal specificity are settled by the order of the stylesheet
 * rather than the order of the `class` attribute. So `${FIELD} h-7 text-xs`
 * silently renders at 34px and 13px — the override loses, and it loses
 * quietly.
 */
const FIELD_CORE =
  "w-full rounded-control border border-line-strong text-ink placeholder:text-ink-faint focus:border-spectre focus:ring-3 focus:ring-spectre-tint focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-42";

const FIELD_BASE = `${FIELD_CORE} px-2.5 text-[13px]`;

/** A box the user types one line into. */
export const FIELD = `${FIELD_BASE} ${CONTROL_HEIGHT} bg-paper-raised`;

/**
 * The same box inside a panel that is itself `paper-raised` — it sits a step
 * back from what it is on, rather than disappearing into it.
 */
export const FIELD_ON_RAISED = `${FIELD_BASE} ${CONTROL_HEIGHT} bg-paper`;

/**
 * The same box with its outline held back until it is wanted. For a column of
 * them — a list of Requirements, where every row is editable and a stack of
 * eight bordered boxes reads as a form rather than as a list of what a job
 * asks for. The border comes back on hover and on focus, so nothing is hidden
 * from anybody who goes looking for it.
 *
 * It states no text size: a quiet box takes the size of the line it is
 * standing in, which is the whole point of it not looking like a box.
 */
export const QUIET_FIELD = `${FIELD_CORE} ${CONTROL_HEIGHT} border-transparent bg-transparent px-2 hover:border-line-strong focus:bg-paper`;

/**
 * The 28px control, for a field or a select that stands on a panel's own
 * header line — where a 34px one would make the header taller than the rule it
 * is a header for.
 */
export const FIELD_SMALL_ON_RAISED = `${FIELD_CORE} h-7 bg-paper px-2 text-xs`;

/** A select draws its own caret out of two gradients: no icon font, no SVG. */
export const SELECT = `${FIELD} caret cursor-pointer`;
export const SELECT_ON_RAISED = `${FIELD_ON_RAISED} caret cursor-pointer`;
export const SELECT_SMALL_ON_RAISED = `${FIELD_SMALL_ON_RAISED} caret cursor-pointer`;

/** A box that grows down the page rather than standing at one line. */
export const TEXTAREA = `${FIELD_BASE} bg-paper-raised py-2 leading-[1.55]`;
export const TEXTAREA_ON_RAISED = `${FIELD_BASE} bg-paper py-2 leading-[1.55]`;

const BUTTON_BASE =
  "inline-flex shrink-0 items-center justify-center gap-[7px] whitespace-nowrap rounded-control border border-transparent font-semibold disabled:cursor-not-allowed disabled:opacity-42";

/**
 * The sign-in page's own control height. It is the one page in the app with a
 * single thing to do and no board behind it, so its two fields and its button
 * stand at 40 and 42 rather than at 34 — a form of two boxes at the app's
 * ordinary density reads as a fragment of a page rather than as the page.
 */
export const FIELD_TALL = `${FIELD_CORE} h-10 bg-paper-raised px-3 text-sm`;
export const PRIMARY_BUTTON_TALL = `${BUTTON_BASE} h-[42px] w-full px-[18px] text-sm bg-ink text-paper-raised hover:bg-spectre`;

/** The one thing on a form worth pressing. */
export const PRIMARY_BUTTON = `${BUTTON_BASE} ${CONTROL_HEIGHT} px-3.5 text-[13px] bg-ink text-paper-raised hover:bg-spectre`;

/**
 * The button beside the one that matters: adding a row to a list, asking
 * again, going back. Outlined rather than filled, so that a form has one
 * obvious thing to press and this is not it.
 *
 * There is no filled-accent button anywhere in the system — the primary button
 * hovering to the brand hue is the one place colour is used as a reward.
 */
export const SECONDARY_BUTTON = `${BUTTON_BASE} ${CONTROL_HEIGHT} px-3.5 text-[13px] bg-paper-raised text-ink-muted border-line-strong hover:text-ink hover:border-ink-faint`;

/** The same, for a control inside a message or beside a field. */
export const SECONDARY_BUTTON_SMALL = `${BUTTON_BASE} h-[28px] px-2.5 text-xs bg-paper-raised text-ink-muted border-line-strong hover:text-ink hover:border-ink-faint`;

/**
 * The same button as the chosen one of a row of them, filled in the page's own
 * ink rather than in an accent — a toggle that is on is not a reading, and
 * colouring it `vital` or `rose` would make it look like one.
 *
 * Written out in full rather than as `${SECONDARY_BUTTON_SMALL} bg-ink …` for
 * the reason `FIELD_CORE` is: Tailwind emits `bg-paper-raised` after `bg-ink`
 * and `border-line-strong` after `border-ink`, so the override would lose and
 * leave paper text on a paper button.
 *
 * It answers the pointer even though it is the one already chosen — pressing
 * it again is what un-chooses it, and a control that does something has to
 * look like it does.
 */
export const CHOSEN_BUTTON_SMALL = `${BUTTON_BASE} h-[28px] px-2.5 text-xs bg-ink text-paper-raised border-ink hover:bg-ink-muted hover:border-ink-muted`;

/**
 * The one that cannot be undone by typing the field back. Outlined rather than
 * filled: a red block is what a page uses to say something has gone wrong, and
 * nothing has gone wrong until the user presses this.
 */
export const DANGER_BUTTON = `${BUTTON_BASE} h-[28px] px-2.5 text-xs bg-transparent text-rose border-rose hover:bg-rose-tint`;

/**
 * A control that is only its icon: 28px square, the page's faint ink until it
 * is pointed at. Every one of these says what it does in an `aria-label`,
 * because an icon on its own is a picture of a verb and not the verb.
 */
export const ICON_BUTTON =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-ink-faint hover:bg-paper-sunk hover:text-ink";

/**
 * A control that reads as a line of prose, for the one thing a sentence can
 * offer: follow it, clear it, undo it. It inherits its colour, so the same
 * button is legible inside a `rose` failure and on the page.
 *
 * Which is why it answers the pointer by thickening its own rule rather than
 * by changing colour: a hover written as `hover:text-ink` would be the one
 * thing in it that stops inheriting, and would go grey inside a red sentence.
 */
export const TEXT_BUTTON =
  "font-medium underline underline-offset-2 hover:decoration-2";

/** What a label says of the control under it. */
export const LABEL =
  "block text-[11px] font-semibold tracking-[0.05em] text-ink-faint uppercase";

/** A labelled control. The label wraps the control, so the whole of it is a target. */
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className={LABEL}>{label}</span>
      {children}
    </label>
  );
}

/** Fields side by side where there is room, stacked where there is not. */
export function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 sm:flex-row">{children}</div>;
}

/**
 * Everything the user has to put right before a form will save. It says what
 * to do rather than that something is wrong, which is the rule for anything a
 * user is being asked to fix.
 */
export function Problems({ problems }: { problems: string[] }) {
  if (problems.length === 0) return null;

  return (
    <ul className="text-xs text-rose" role="alert">
      {problems.map((problem) => (
        <li key={problem}>{problem}</li>
      ))}
    </ul>
  );
}
