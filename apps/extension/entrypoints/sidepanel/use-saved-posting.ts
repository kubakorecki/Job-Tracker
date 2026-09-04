import type { JobApplication, JobStatus } from "@repo/schema";
import { useEffect, useState } from "react";
import { lookUpPosting, patchJobApplication } from "../../lib/api";
import { readActiveUrl } from "../../lib/page";
import type { Settings } from "../../lib/settings";

/**
 * Whether the Posting in front of the user is one they already saved.
 *
 * This is the one thing the panel asks on open (ADR-0002). It is safe to,
 * because it costs a request and nothing else: no page is read, and no share
 * of the extraction grant is spent — which is exactly what makes it worth
 * doing before the user has asked for anything, and what keeps ticket 09's
 * rule that extraction never runs on open.
 */

/**
 * Where the lookup has got to. A tab whose address cannot be read, and a
 * lookup that failed, both land on `unknown`: the panel answers both by
 * offering to read the page in the ordinary way, because a Posting it cannot
 * rule out being new is one the user may still want to save.
 */
export type PostingLookup =
  | { kind: "unknown" }
  | { kind: "looking" }
  | { kind: "saved"; jobApplication: JobApplication }
  | { kind: "token-rejected" };

export function useSavedPosting(
  settings: Settings | null,
  /** Bumped by the panel when a save may have changed the answer. */
  reloads: number,
): {
  lookup: PostingLookup;
  /** Moves the Job Application along, answering with whatever stopped it. */
  setStatus: (status: JobStatus) => Promise<string[]>;
} {
  const [lookup, setLookup] = useState<PostingLookup>({ kind: "unknown" });

  const token = settings?.token;
  const apiBaseUrl = settings?.apiBaseUrl;

  useEffect(() => {
    if (token === undefined || apiBaseUrl === undefined) {
      setLookup({ kind: "unknown" });
      return;
    }

    let cancelled = false;
    setLookup({ kind: "looking" });

    (async () => {
      const url = await readActiveUrl();
      if (cancelled) return;

      // Nothing to look up, and nothing wrong: the panel is over a tab the
      // extension has no access to, and the ordinary "Save this job" path is
      // what says so, in its own words, when the user asks.
      if (url === null) {
        setLookup({ kind: "unknown" });
        return;
      }

      const outcome = await lookUpPosting({ token, apiBaseUrl }, url);
      if (cancelled) return;

      switch (outcome.kind) {
        case "looked-up":
          setLookup(
            outcome.jobApplication === null
              ? { kind: "unknown" }
              : { kind: "saved", jobApplication: outcome.jobApplication },
          );
          return;

        case "token-rejected":
          setLookup({ kind: "token-rejected" });
          return;

        // A lookup the API refused is not worth a line of its own: the panel
        // has a place for what went wrong — the action the user takes next —
        // and this one nobody asked for.
        case "failed":
          setLookup({ kind: "unknown" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, apiBaseUrl, reloads]);

  return {
    lookup,

    setStatus: async (status) => {
      // Neither can happen: the control this answers is only rendered for a
      // Job Application the lookup found, in a panel that has settings.
      if (settings === null || lookup.kind !== "saved") return [];

      const outcome = await patchJobApplication(
        settings,
        lookup.jobApplication.id,
        { status },
      );

      switch (outcome.kind) {
        case "failed":
          return outcome.problems;

        case "token-rejected":
          setLookup({ kind: "token-rejected" });
          return [];

        // Taken from the response rather than from the value that was sent:
        // moving to `applied` stamps the applied date, and the Job
        // Application the panel holds should be the one the API now has.
        case "saved":
          setLookup({
            kind: "saved",
            jobApplication: outcome.jobApplication,
          });
          return [];
      }
    },
  };
}
