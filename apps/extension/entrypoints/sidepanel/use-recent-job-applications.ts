import { useEffect, useState } from "react";
import { fetchRecentJobApplications, type RecentOutcome } from "../../lib/api";
import type { Settings } from "../../lib/settings";

/**
 * What the API answered, and everything that is true before it has. `idle` is
 * a panel with no token yet: there is nobody to ask.
 */
export type Recent = { kind: "idle" } | { kind: "loading" } | RecentOutcome;

export function useRecentJobApplications(settings: Settings | null): Recent {
  const [recent, setRecent] = useState<Recent>({ kind: "idle" });

  // The two values the request is made of, rather than the object holding
  // them: settings that are re-saved unchanged are a new object every time,
  // and comparing the strings is what keeps that from refetching the list.
  const token = settings?.token;
  const apiBaseUrl = settings?.apiBaseUrl;

  useEffect(() => {
    if (token === undefined || apiBaseUrl === undefined) {
      setRecent({ kind: "idle" });
      return;
    }

    let cancelled = false;
    setRecent({ kind: "loading" });

    fetchRecentJobApplications({ token, apiBaseUrl }).then((outcome) => {
      if (!cancelled) setRecent(outcome);
    });

    return () => {
      cancelled = true;
    };
  }, [token, apiBaseUrl]);

  return recent;
}
