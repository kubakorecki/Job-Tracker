import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../../lib/auth/current-user";
import { DASHBOARD_PATH, SIGN_IN_PATH } from "../../../lib/auth/route-access";
import { listPersonalAccessTokens } from "../../../lib/personal-access-tokens/repository";
import { PersonalAccessTokens } from "./personal-access-tokens";

export default async function PersonalAccessTokensPage() {
  // The proxy already turned signed-out traffic away; this is the page's own
  // guarantee that `user` is real, and how it learns whose tokens to list.
  const user = await getCurrentUser();
  if (user === null) redirect(SIGN_IN_PATH);

  // Read through the repository, scoped by the user's id (ADR-0001). The list
  // never carries a hash: the repository has no way to hand one out.
  const tokens = await listPersonalAccessTokens(user.id);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-12">
      <header className="flex flex-col gap-2">
        <Link
          className="text-sm underline underline-offset-2 opacity-60"
          href={DASHBOARD_PATH}
        >
          ← Back to the board
        </Link>
        <h1 className="text-2xl font-semibold">Personal Access Tokens</h1>
        <p className="text-sm opacity-60">
          A token lets the browser extension reach your Job Applications without
          your password. Give each machine its own, and revoke one the moment
          you lose the machine it lives on.
        </p>
      </header>

      <PersonalAccessTokens tokens={tokens} />
    </main>
  );
}
