"use client";

import Link from "next/link";
import { DASHBOARD_PATH } from "../../../../lib/auth/route-access";
import { Failure } from "../../../states";

/**
 * This Job Application could not be read. A Job Application that does not
 * exist never reaches here — the page answers that with `notFound()` — so what
 * is left is a read that failed, and asking again is worth offering.
 */
export default function JobApplicationError({ retry }: { retry: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-12">
      <Link
        className="text-sm underline underline-offset-2 opacity-60"
        href={DASHBOARD_PATH}
      >
        ← Back to the board
      </Link>
      <Failure onRetry={retry} what="this Job Application" />
    </main>
  );
}
