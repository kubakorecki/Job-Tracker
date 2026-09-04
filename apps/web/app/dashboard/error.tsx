"use client";

import { Failure } from "../states";

/**
 * The board's Job Applications could not be read. `retry` re-fetches this
 * segment on the server, which is the only thing that could change the answer
 * — a database that was asleep, a deploy mid-flight — so it is the button.
 *
 * Nothing of `error` is shown: an error thrown in a server component reaches
 * the browser with its message replaced by a paragraph about why the message
 * was replaced, and that is worse than saying nothing.
 */
export default function DashboardError({ retry }: { retry: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 p-12">
      <h1 className="text-2xl font-semibold">Job Tracker</h1>
      <Failure onRetry={retry} what="your Job Applications" />
    </main>
  );
}
