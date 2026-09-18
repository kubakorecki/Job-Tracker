"use client";

import { Ghost, Wordmark } from "../../ghost";
import { Failure } from "../../states";

/**
 * The record behind the month could not be read. `retry` re-fetches this
 * segment on the server, which is the only thing that could change the answer.
 *
 * Nothing of `error` is shown, for the reason the board's failure shows
 * nothing: an error thrown in a server component reaches the browser with its
 * message replaced by a paragraph about why the message was replaced.
 */
export default function ActivityReportError({ retry }: { retry: () => void }) {
  return (
    <main className="flex min-h-screen flex-col bg-paper">
      <header className="flex h-[60px] items-center border-b border-line bg-paper-raised px-6 lg:px-16">
        <span className="flex items-center gap-[9px] text-ink">
          <Ghost size={21} />
          <Wordmark />
        </span>
      </header>
      <div className="px-6 pt-[30px] lg:px-16">
        <Failure
          onRetry={retry}
          standing="Nothing has been lost: a report is made from the record each time it is opened, and a draft you were typing is still in this browser."
          what="the month behind your report"
        />
      </div>
    </main>
  );
}
