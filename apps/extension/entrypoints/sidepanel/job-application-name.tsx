import type { JobApplication } from "@repo/schema";

/**
 * How the panel writes a Job Application down: the company, and the job title
 * under it. Both places that show one — the recent list, and the Posting the
 * user has already saved — write it this way, so that recognising a Job
 * Application does not depend on which half of the panel it is in.
 */
export function JobApplicationName({
  jobApplication,
}: {
  jobApplication: JobApplication;
}) {
  return (
    <div className="job-application-name">
      <p className="company">{jobApplication.company}</p>
      <p className="job-title">{jobApplication.jobTitle}</p>
    </div>
  );
}
