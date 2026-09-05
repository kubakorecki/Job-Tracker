"use client";

import Link from "next/link";
import { DASHBOARD_PATH } from "../../../lib/auth/route-access";
import { Failure } from "../../states";

/**
 * The Profile could not be read. Reading one is a query and a signed URL, so
 * this is as likely to be the store as the database — either way the CV is
 * still there, and asking again is the whole of what there is to do.
 *
 * The way back to the board is kept, so a user who found this page broken does
 * not have to type a URL to leave.
 */
export default function ProfileError({ retry }: { retry: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-12">
      <Link
        className="text-sm underline underline-offset-2 opacity-60"
        href={DASHBOARD_PATH}
      >
        ← Back to the board
      </Link>
      <h1 className="text-2xl font-semibold">Your Profile</h1>
      <Failure onRetry={retry} what="your Profile" />
    </main>
  );
}
