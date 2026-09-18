import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "../lib/auth/actions";
import { DASHBOARD_PATH } from "../lib/auth/route-access";
import { ConversationPanel } from "./conversation-panel";
import { SECONDARY_BUTTON } from "./form";
import { Ghost, Wordmark } from "./ghost";

/**
 * The one thing on every signed-in page: the mark, the way back to the board,
 * and the way out.
 *
 * It is 60px of `paper-raised` over the page's own `paper`, which is the whole
 * of how the app says where it stops and the content starts — there is no
 * shadow anywhere in this system.
 *
 * `action` is the page's own primary thing to do, which only the board has.
 * It is a slot rather than a prop the bar interprets, because whether a page
 * has such a thing, and what it is, is that page's business.
 *
 * The Conversation hangs off the bar rather than off any page, and for the
 * same reason the bar itself does: it is on every signed-in page, and asking
 * a question should never cost the user their place. It is deliberately not
 * the `action` slot — that belongs to one page, and this belongs to all of
 * them.
 */
export function AppBar({
  email,
  action,
}: {
  /** Who is signed in, which the avatar abbreviates and its label says. */
  email: string;
  action?: ReactNode;
}) {
  return (
    // `print:hidden`, because the one thing this app prints is the Activity
    // Report and nothing of the application's own interface belongs on a sheet
    // handed to a labour office.
    <header className="flex h-[60px] items-center justify-between gap-6 border-b border-line bg-paper-raised px-6 print:hidden lg:px-16">
      <Link
        className="flex items-center gap-[9px] text-ink hover:text-ink"
        href={DASHBOARD_PATH}
      >
        <Ghost size={21} />
        <Wordmark />
      </Link>

      <div className="flex items-center gap-2.5">
        {/* A destination rather than an action, like the Profile beside it:
            the Activity Report is a page the user goes to once a month, and
            the bar is the one thing on every signed-in page. It is named as
            `CONTEXT.md` names it — "report" on its own is on that entry's
            list of words to avoid, and the bar is not the place to start
            calling one thing two things. */}
        <Link className={SECONDARY_BUTTON} href="/dashboard/report">
          <Sheet />
          <span className="hidden sm:inline">Activity Report</span>
        </Link>

        <Link className={SECONDARY_BUTTON} href="/settings/profile">
          <Board />
          <span className="hidden sm:inline">Your Profile</span>
        </Link>

        {action}

        <ConversationPanel />

        {/* Identity, not a control. Signing out is the button beside it and
            says so — an avatar that logged you out because you went looking
            for a menu is the one surprise a bar this small can still spring. */}
        <span
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-line bg-spectre-tint text-[11px] font-semibold text-spectre"
          title={email}
        >
          {initialsOf(email)}
        </span>

        <form action={signOut}>
          <button
            className="text-xs font-medium text-ink-faint hover:text-ink"
            type="submit"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}

/**
 * The page under the bar. Gutters match the bar's, so the wordmark and the
 * first thing on the page share an edge.
 */
export function Page({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen flex-col bg-paper">{children}</div>;
}

/** The page's own body, inside the gutters the bar sets. */
export function PageBody({ children }: { children: ReactNode }) {
  return (
    // The gutters are the screen's. On paper the margin is the sheet's own,
    // set by `@page` in `globals.css`, and 64px of it again would cost the
    // form a column's width.
    <div className="flex flex-1 flex-col gap-[18px] px-6 pt-[30px] pb-11 print:p-0 lg:px-16">
      {children}
    </div>
  );
}

/**
 * Two letters out of an email address — the part before the `@`, split on the
 * punctuation people put names either side of. One letter where there is only
 * one word, because an avatar with three is a word rather than a mark.
 */
function initialsOf(email: string): string {
  const words = email
    .split("@")[0]!
    .split(/[.\-_+]/)
    .filter((word) => word !== "");

  if (words.length === 0) return "?";

  const first = words[0]![0]!;
  const last = words.length > 1 ? words[words.length - 1]![0]! : "";

  return `${first}${last}`.toUpperCase();
}

/** The report icon: a sheet with three rules on it. Same grid as the rest. */
function Sheet() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      width="14"
    >
      <path d="M5 3h14v18H5z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  );
}

/** The Profile icon: a CV as three blocks. 24px grid, 1.7px stroke, no fill. */
function Board() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      width="14"
    >
      <path d="M4 4h16v5H4z" />
      <path d="M4 13h9v7H4z" />
      <path d="M17 13h3v7h-3z" />
    </svg>
  );
}
