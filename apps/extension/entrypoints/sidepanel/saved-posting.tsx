import { JobStatus, type JobApplication } from "@repo/schema";
import { JOB_STATUS_LABELS } from "@repo/ui/status-badge";
import { useState } from "react";
import { jobApplicationPage } from "../../lib/api";
import { AddManually } from "./capture-actions";
import { JobApplicationName } from "./job-application-name";
import { Problems } from "./problems";

/**
 * The Posting the user is looking at, which they have already saved. It stands
 * where "Save this job" would, and it deliberately offers no way to extract
 * the page again: the Job Application is the record now, and a second
 * extraction could only produce a Draft with nowhere to go — the save would be
 * refused as a duplicate (ADR-0002), and overwriting the user's own
 * corrections with the model's second guess is not something they asked for.
 *
 * What it does offer is the one change worth making from a Posting: where the
 * Job Application sits in the pipeline. Everything else is edited in the
 * dashboard, a link away.
 */
export function SavedPosting({
  jobApplication,
  onSetStatus,
  onAddManually,
  apiBaseUrl,
}: {
  jobApplication: JobApplication;
  /** Moves it, and answers with whatever stopped it. Empty means it moved. */
  onSetStatus: (status: JobStatus) => Promise<string[]>;
  onAddManually: () => void;
  apiBaseUrl: string;
}) {
  const [problems, setProblems] = useState<string[]>([]);
  const [moving, setMoving] = useState(false);

  const move = async (value: string) => {
    // The options below are `JobStatus.options`, so this cannot fail — it is
    // how the string a `<select>` hands back becomes the contract's own type,
    // rather than a cast asserting the same thing without checking it.
    const status = JobStatus.safeParse(value);
    if (!status.success) return;

    setMoving(true);
    try {
      setProblems(await onSetStatus(status.data));
    } finally {
      setMoving(false);
    }
  };

  return (
    <section>
      <h2>Already saved</h2>

      <div className="job-application">
        <JobApplicationName jobApplication={jobApplication} />
      </div>

      {/*
        A control rather than a badge. The panel is open on the Posting at the
        moment the user has news about it — they have just applied, or just
        been turned down — and a badge would send them to the dashboard to say
        so.
      */}
      <label className="field">
        <span>Status</span>
        <select
          disabled={moving}
          onChange={(event) => move(event.target.value)}
          value={jobApplication.status}
        >
          {JobStatus.options.map((status) => (
            <option key={status} value={status}>
              {JOB_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>

      <Problems problems={problems} />

      <div className="actions">
        <a
          className="link"
          href={jobApplicationPage(apiBaseUrl, jobApplication.id)}
          rel="noreferrer"
          target="_blank"
        >
          Edit in the dashboard
        </a>
        <AddManually onClick={onAddManually} />
      </div>
    </section>
  );
}
