import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "../../../../lib/auth/current-user";
import { SIGN_IN_PATH } from "../../../../lib/auth/route-access";
import { isJobApplicationId } from "../../../../lib/job-applications/api";
import { getJobApplication } from "../../../../lib/job-applications/repository";
import { acceptedSkills } from "../../../../lib/profile/repository";
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

  // Whether there is anything to compare a Requirement against. The page reads
  // it rather than the component inferring it from the readings, because "we
  // have not read this" and "you have told us nothing to read it against" look
  // alike on a Requirement and are two different things to tell the user.
  const skills = await acceptedSkills(user.id);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-12">
      <JobApplicationDetail
        hasProfileSkills={skills.length > 0}
        jobApplication={jobApplication}
      />
    </main>
  );
}
