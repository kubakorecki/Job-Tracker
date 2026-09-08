import { notFound, redirect } from "next/navigation";
import { readAnalysis } from "../../../../lib/analysis/view";
import { getCurrentUser } from "../../../../lib/auth/current-user";
import { SIGN_IN_PATH } from "../../../../lib/auth/route-access";
import { isJobApplicationId } from "../../../../lib/job-applications/api";
import { getJobApplication } from "../../../../lib/job-applications/repository";
import { acceptedSkills } from "../../../../lib/profile/repository";
import { AppBar, Page, PageBody } from "../../../app-bar";
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

  // What the page knows about this Job Application beyond the record itself.
  // Neither read waits on the other.
  const [skills, analysis] = await Promise.all([
    // Whether there is anything to compare a Requirement against. The page
    // reads it rather than the component inferring it from the readings,
    // because "we have not read this" and "you have told us nothing to read it
    // against" look alike on a Requirement and are two different things to
    // tell the user.
    acceptedSkills(user.id),
    // Read through the feature rather than through its own endpoint, as the
    // Profile page does: this renders on the server, where an HTTP hop to this
    // app's own API would buy nothing. Whether the run is stale is decided
    // there and travels with it, so the banner renders an answer rather than
    // reaching one.
    readAnalysis(user.id, jobApplication),
  ]);

  // The same bar as the board, and no "Track a job" on it: that button opens a
  // panel over the board, and offering it here would be a way out of a page
  // the user is in the middle of editing.
  return (
    <Page>
      <AppBar email={user.email ?? user.id} />
      <PageBody>
        <JobApplicationDetail
          analysis={analysis}
          hasProfileSkills={skills.length > 0}
          jobApplication={jobApplication}
        />
      </PageBody>
    </Page>
  );
}
