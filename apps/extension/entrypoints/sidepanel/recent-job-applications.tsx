import { StatusBadge } from "@repo/ui/status-badge";
import { JobApplicationName } from "./job-application-name";
import { Problems } from "./problems";
import type { JobApplications } from "./use-job-applications";

/** How many of them the panel has room for. */
const RECENT_LIMIT = 5;

/**
 * The bottom half of the shell: what the user last saved, so that the panel
 * says something useful on a page that is not a Posting at all. A refused
 * token is not reported here — the primary action area above says it once, and
 * offers the way out.
 */
export function RecentJobApplications({
  jobApplications,
}: {
  jobApplications: JobApplications;
}) {
  const shown = contents(jobApplications);

  // Nothing to say and no heading over it: a lone "Recent" with a blank space
  // under it reads as a list that failed to arrive.
  if (shown === null) return null;

  return (
    <section>
      <h2>Recent</h2>
      {shown}
    </section>
  );
}

function contents(outcome: JobApplications) {
  switch (outcome.kind) {
    case "idle":
    case "token-rejected":
      return null;

    case "loading":
      return <p className="muted">Loading…</p>;

    case "failed":
      return <Problems problems={outcome.problems} />;

    case "ready":
      return outcome.jobApplications.length === 0 ? (
        <p className="muted">Nothing saved yet.</p>
      ) : (
        <ul className="job-applications">
          {outcome.jobApplications
            .slice(0, RECENT_LIMIT)
            .map((jobApplication) => (
              <li className="job-application" key={jobApplication.id}>
                <JobApplicationName jobApplication={jobApplication} />
                <StatusBadge status={jobApplication.status} />
              </li>
            ))}
        </ul>
      );
  }
}
