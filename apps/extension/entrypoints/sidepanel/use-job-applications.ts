import type { JobApplication } from "@repo/schema";
import { useEffect, useState } from "react";
import { fetchJobApplications, type ListOutcome } from "../../lib/api";
import type { Settings } from "../../lib/settings";

/**
 * Everything the user has saved, and everything that is true before the API
 * has said. `idle` is a panel with no token yet: there is nobody to ask.
 *
 * The panel reads this list for two things — the handful it shows at the
 * bottom, and the near-duplicate hint (ADR-0002), which has to look at every
 * Job Application at a company rather than the last few. One fetch answers
 * both.
 */
export type JobApplications =
  { kind: "idle" } | { kind: "loading" } | ListOutcome;

export function useJobApplications(
  settings: Settings | null,
  /**
   * Bumped by the panel when a save may have changed the answer. The panel
   * writes through the same endpoint it reads, so after a save the list it is
   * holding is one Job Application out of date, and nothing else would tell it.
   */
  reloads: number,
): JobApplications {
  const [jobApplications, setJobApplications] = useState<JobApplications>({
    kind: "idle",
  });

  // The two values the request is made of, rather than the object holding
  // them: settings that are re-saved unchanged are a new object every time,
  // and comparing the strings is what keeps that from refetching the list.
  const token = settings?.token;
  const apiBaseUrl = settings?.apiBaseUrl;

  useEffect(() => {
    if (token === undefined || apiBaseUrl === undefined) {
      setJobApplications({ kind: "idle" });
      return;
    }

    let cancelled = false;
    setJobApplications({ kind: "loading" });

    fetchJobApplications({ token, apiBaseUrl }).then((outcome) => {
      if (!cancelled) setJobApplications(outcome);
    });

    return () => {
      cancelled = true;
    };
  }, [token, apiBaseUrl, reloads]);

  return jobApplications;
}

/** The Job Applications a caller can actually read, or none yet. */
export function listed(jobApplications: JobApplications): JobApplication[] {
  return jobApplications.kind === "ready"
    ? jobApplications.jobApplications
    : [];
}
