"use client";

import Link from "next/link";
import { DASHBOARD_PATH } from "../../../lib/auth/route-access";
import { Failure } from "../../states";

/**
 * The Personal Access Tokens could not be read. The way back to the board is
 * kept: a user who came here to set up the extension and found the page broken
 * should not have to type a URL to leave.
 */
export default function PersonalAccessTokensError({
  retry,
}: {
  retry: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-12">
      <Link
        className="text-sm underline underline-offset-2 opacity-60"
        href={DASHBOARD_PATH}
      >
        ← Back to the board
      </Link>
      <h1 className="text-2xl font-semibold">Personal Access Tokens</h1>
      <Failure onRetry={retry} what="your Personal Access Tokens" />
    </main>
  );
}
