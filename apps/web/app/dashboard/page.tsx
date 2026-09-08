import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth/current-user";
import { SIGN_IN_PATH } from "../../lib/auth/route-access";
import { listJobApplications } from "../../lib/job-applications/repository";
import { Dashboard } from "./dashboard";

export default async function DashboardPage() {
  // The proxy already turned signed-out traffic away; this is the page's own
  // guarantee that `user` is real, and how it learns who is looking.
  const user = await getCurrentUser();
  if (user === null) redirect(SIGN_IN_PATH);

  // Reading through the repository rather than the endpoint: this renders on
  // the server, where an HTTP hop to itself would buy nothing. The user's id
  // is still the argument that scopes it (ADR-0001). From here on the board
  // owns this list, and re-reads it through the endpoint.
  const jobApplications = await listJobApplications(user.id);

  // The bar, the tally and the board are one client tree rather than a server
  // shell around a client board: the bar carries "Track a job", which opens a
  // panel under it, and a button and the thing it opens should not be on two
  // sides of a boundary.
  return (
    <main>
      <Dashboard
        email={user.email ?? user.id}
        initialJobApplications={jobApplications}
      />
    </main>
  );
}
