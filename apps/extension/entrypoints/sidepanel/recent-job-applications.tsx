import { StatusBadge } from "@repo/ui/status-badge";
import type { Recent } from "./use-recent-job-applications";

/**
 * The bottom half of the shell: what the user last saved, so that the panel
 * says something useful on a page that is not a Posting at all. A refused
 * token is not reported here — the primary action area above says it once, and
 * offers the way out.
 */
export function RecentJobApplications({ recent }: { recent: Recent }) {
  const shown = contents(recent);

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

function contents(recent: Recent) {
  switch (recent.kind) {
    case "idle":
    case "token-rejected":
      return null;

    case "loading":
      return <p className="muted">Loading…</p>;

    case "failed":
      return (
        <p className="problem" role="alert">
          {recent.problem}
        </p>
      );

    case "ready":
      return recent.jobApplications.length === 0 ? (
        <p className="muted">Nothing saved yet.</p>
      ) : (
        <ul className="job-applications">
          {recent.jobApplications.map((jobApplication) => (
            <li className="job-application" key={jobApplication.id}>
              <div className="job-application-name">
                <p className="company">{jobApplication.company}</p>
                <p className="job-title">{jobApplication.jobTitle}</p>
              </div>
              <StatusBadge status={jobApplication.status} />
            </li>
          ))}
        </ul>
      );
  }
}
