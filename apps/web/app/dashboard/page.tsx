import { Card } from "@repo/ui/card";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth/current-user";
import { SIGN_IN_PATH } from "../../lib/auth/route-access";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardPage() {
  // The proxy already turned signed-out traffic away; this is the page's own
  // guarantee that `user` is real, and how it learns who is looking.
  const user = await getCurrentUser();
  if (user === null) redirect(SIGN_IN_PATH);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Job Tracker</h1>
          <p className="text-sm opacity-60">
            Signed in as {user.email ?? user.id}
          </p>
        </div>
        <SignOutButton />
      </header>

      <Card title="Your board">
        <p>
          Nothing here yet — the board arrives with the Job Applications table.
        </p>
      </Card>
    </main>
  );
}
