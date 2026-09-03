import { useEffect, useState } from "react";
import {
  readSettings,
  watchSettings,
  writeSettings,
  type Settings,
} from "../../lib/settings";

/**
 * The stored token and API base URL, as the panel holds them. `loading` is the
 * moment before storage has answered: `settings` is null then too, and asking
 * for a token on the strength of that would flash the setup form at a user who
 * set up months ago.
 */
export function useSettings(): {
  settings: Settings | null;
  loading: boolean;
  save: (settings: Settings) => Promise<void>;
} {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    readSettings().then((stored) => {
      if (cancelled) return;
      setSettings(stored);
      setLoading(false);
    });

    const unwatch = watchSettings((stored) => {
      if (!cancelled) setSettings(stored);
    });

    return () => {
      cancelled = true;
      unwatch();
    };
  }, []);

  return {
    settings,
    loading,
    // Written first, so that what the panel shows next is what a reload would
    // show. The watch above reports the same write back; setting the state
    // here as well is what makes the panel react to it in this window before
    // the storage event has been round the browser.
    save: async (next: Settings) => {
      await writeSettings(next);
      setSettings(next);
    },
  };
}
