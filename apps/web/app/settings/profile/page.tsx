import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../../lib/auth/current-user";
import { DASHBOARD_PATH, SIGN_IN_PATH } from "../../../lib/auth/route-access";
import { readProfile } from "../../../lib/profile/view";
import { YourProfile } from "./profile";

export default async function ProfilePage() {
  // The proxy already turned signed-out traffic away; this is the page's own
  // guarantee that `user` is real, and how it learns whose Profile to read.
  const user = await getCurrentUser();
  if (user === null) redirect(SIGN_IN_PATH);

  // Read through the feature rather than through its endpoint: this renders on
  // the server, where an HTTP hop to this app's own API would buy nothing. The
  // user's id is still the argument that scopes it (ADR-0001). From here the
  // page owns the Profile, because an upload answers with more of it than any
  // re-read could.
  const profile = await readProfile(user.id);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-12">
      <header className="flex flex-col gap-2">
        <Link
          className="text-sm underline underline-offset-2 opacity-60"
          href={DASHBOARD_PATH}
        >
          ← Back to the board
        </Link>
        <h1 className="text-2xl font-semibold">Your Profile</h1>
        <p className="text-sm opacity-60">
          One master CV, kept as the file you uploaded, and the skills read out
          of it. This is what a Job Application gets measured against.
        </p>
      </header>

      <YourProfile profile={profile} />
    </main>
  );
}
