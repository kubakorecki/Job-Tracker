import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "../../../../lib/auth/current-user";
import { SIGN_IN_PATH } from "../../../../lib/auth/route-access";
import { isJobApplicationId } from "../../../../lib/job-applications/api";
import { getJobApplication } from "../../../../lib/job-applications/repository";
import { JobApplicationDetail } from "./job-application-detail";

export default async function JobApplicationPage({
  params,
}: PageProps<"/dashboard/job-applications/[id]">) {
  // The proxy already turned signed-out traffic away; this is the page's own
  // guarantee that `user` is real, and how it learns whose Job Application to
  // look for.
  const user = await getCurrentUser();
  if (user === null) redirect(SIGN_IN_PATH);

  const { id } = await params;

  // Read through the repository, scoped by the user's id (ADR-0001), and give
  // somebody else's Job Application the same answer as one that does not
  // exist — the same answer the endpoint gives, so a stranger's row is never
  // confirmed to be real by the page either.
  const jobApplication = isJobApplicationId(id)
    ? await getJobApplication(user.id, id)
    : null;
  if (jobApplication === null) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-12">
      <JobApplicationDetail jobApplication={jobApplication} />
    </main>
  );
}
