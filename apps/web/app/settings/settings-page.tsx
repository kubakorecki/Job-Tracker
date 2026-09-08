import Link from "next/link";
import type { ReactNode } from "react";
import { DASHBOARD_PATH } from "../../lib/auth/route-access";
import { AppBar, Page, PageBody } from "../app-bar";
import { Ghost, Wordmark } from "../ghost";

/**
 * The shell every page under `/settings` is drawn in: the app's bar, the way
 * back to the board, a display heading and one sentence saying what the page
 * is for.
 *
 * It lives here rather than being written twice because there are two of these
 * pages and they are the same page — a title, a lede and one panel-shaped
 * thing — and two copies of a shell is how the Profile page and the tokens
 * page come to have headings a different size.
 *
 * `email` is optional because the same shell has to stand on `loading.tsx` and
 * `error.tsx`, where nobody has been read yet. The bar is drawn without its
 * controls there, as the board's failure draws it: nothing behind it is known
 * to work, and a way into another page is an offer the app cannot keep.
 */
export function SettingsPage({
  email,
  title,
  lede,
  children,
}: {
  email?: string;
  title: string;
  /** What this page is for, in one sentence. */
  lede?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Page>
      {email === undefined ? <BareBar /> : <AppBar email={email} />}

      <PageBody>
        <Link
          className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-ink-muted hover:text-ink"
          href={DASHBOARD_PATH}
        >
          <Back />
          Back to the board
        </Link>

        <header className="max-w-[620px]">
          <h1 className="type-display">{title}</h1>
          {lede !== undefined && (
            <p className="mt-2.5 text-[13.5px] leading-[1.55] text-ink-muted">
              {lede}
            </p>
          )}
        </header>

        {/* A settings page is a column of panels, at the section gap rather
            than the board's tighter one — there is one thing on each of them
            and nothing to scan across. */}
        <div className="flex max-w-[860px] flex-col gap-5">{children}</div>
      </PageBody>
    </Page>
  );
}

/** The bar with the mark and nothing else, for a page with no user to name. */
function BareBar() {
  return (
    <header className="flex h-[60px] items-center border-b border-line bg-paper-raised px-6 lg:px-16">
      <span className="flex items-center gap-[9px] text-ink">
        <Ghost size={21} />
        <Wordmark />
      </span>
    </header>
  );
}

/** Back to where the user came from: 24px grid, no fill. */
function Back() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
      viewBox="0 0 24 24"
      width="14"
    >
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}
