"use client";

import Link from "next/link";
import { DASHBOARD_PATH } from "../../../../lib/auth/route-access";
import { Ghost, Wordmark } from "../../../ghost";
import { Failure } from "../../../states";

/**
 * This Job Application could not be read. A Job Application that does not
 * exist never reaches here — the page answers that with `notFound()` — so what
 * is left is a read that failed, and asking again is worth offering.
 *
 * The bar is drawn without its controls, as the board's failure draws it:
 * nothing behind it is known to work, and a page that could not be read is no
 * place to offer the way into another one.
 */
export default function JobApplicationError({ retry }: { retry: () => void }) {
  return (
    <main className="flex min-h-screen flex-col bg-paper">
      <header className="flex h-[60px] items-center border-b border-line bg-paper-raised px-6 lg:px-16">
        <span className="flex items-center gap-[9px] text-ink">
          <Ghost size={21} />
          <Wordmark />
        </span>
      </header>
      <div className="flex flex-col gap-[18px] px-6 pt-[30px] pb-11 lg:px-16">
        <Link
          className="w-fit text-[13px] font-medium text-ink-muted hover:text-ink"
          href={DASHBOARD_PATH}
        >
          ← Back to the board
        </Link>
        <Failure onRetry={retry} what="this Job Application" />
      </div>
    </main>
  );
}
