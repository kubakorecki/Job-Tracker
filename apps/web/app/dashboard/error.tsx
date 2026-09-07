"use client";

import { Failure } from "../states";
import { Ghost, Wordmark } from "../ghost";

/**
 * The board's Job Applications could not be read. `retry` re-fetches this
 * segment on the server, which is the only thing that could change the answer
 * — a database that was asleep, a deploy mid-flight — so it is the button.
 *
 * The bar is drawn without its controls: nothing behind it is known to work,
 * and a "Track a job" button over a page that could not be read would be an
 * offer the app cannot keep.
 *
 * Nothing of `error` is shown: an error thrown in a server component reaches
 * the browser with its message replaced by a paragraph about why the message
 * was replaced, and that is worse than saying nothing.
 */
export default function DashboardError({ retry }: { retry: () => void }) {
  return (
    <main className="flex min-h-screen flex-col bg-paper">
      <header className="flex h-[60px] items-center border-b border-line bg-paper-raised px-6 lg:px-16">
        <span className="flex items-center gap-[9px] text-ink">
          <Ghost size={21} />
          <Wordmark />
        </span>
      </header>
      <div className="px-6 pt-[30px] lg:px-16">
        <Failure onRetry={retry} what="your Job Applications" />
      </div>
    </main>
  );
}
