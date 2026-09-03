import { storage } from "#imports";

/**
 * What the panel has to be told before it can reach the API: a Personal Access
 * Token issued in the dashboard, and where the API lives. There is no sign-in
 * here — the extension has no session cookie and no identity API (the token
 * stands in for both), so these two values are the whole of its first run.
 *
 * They live in `local` storage rather than `session` so that a browser restart
 * does not ask for them again, and so that every window's side panel — Chrome
 * gives each window its own — reads the same pair.
 */
export type Settings = {
  /** The raw token, exactly as the dashboard showed it once. */
  token: string;
  /** Where this panel's Job Tracker is served from, with no trailing slash. */
  apiBaseUrl: string;
};

/** Where the dashboard and its API are served from by `pnpm dev`. */
const LOCAL_API_BASE_URL = "http://localhost:3000";

/** Where they are served from once deployed (`docs/setup/deployment.md`). */
const DEPLOYED_API_BASE_URL = "https://job-tracker-web-pi.vercel.app";

/**
 * Where the panel points when the user has not said otherwise. It is decided
 * at build time, so a development build talks to the dev server and a
 * production build to the deployment without either one carrying a switch:
 * `import.meta.env.DEV` is replaced by a literal before the bundle is written.
 *
 * `WXT_API_BASE_URL` overrides both, for a build aimed at a preview
 * deployment. WXT reads `WXT_`-prefixed variables out of the environment and
 * inlines them the same way; the repo's `.gitignore` keeps `.env` files out,
 * so it is set on the command line and named in `turbo.json`'s `globalEnv` so
 * that a cached build is not reused across two different values.
 *
 * Whatever this resolves to is only ever a default: it fills in the setup
 * form's field, and the value the user saves there is what the panel uses.
 */
export const DEFAULT_API_BASE_URL: string =
  import.meta.env.WXT_API_BASE_URL ??
  (import.meta.env.DEV ? LOCAL_API_BASE_URL : DEPLOYED_API_BASE_URL);

/**
 * The API base URL as it will be stored, or `null` when what was typed could
 * never address an API. It is both the setup form's validation and the way
 * every stored URL arrives in one shape, so that the rest of the panel can
 * append `/api/job-applications` to it without wondering about a trailing
 * slash. A bare host is refused rather than guessed at: `localhost:3000`
 * parses as a URL whose protocol is `localhost:`.
 */
export function parseApiBaseUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

const stored = storage.defineItem<Settings>("local:settings");

/** The stored pair, or `null` on a first run. */
export function readSettings(): Promise<Settings | null> {
  return stored.getValue();
}

export function writeSettings(settings: Settings): Promise<void> {
  return stored.setValue(settings);
}

/**
 * Follows the stored pair as it changes. A side panel is one document per
 * browser window, so a token pasted into one window's panel is news to every
 * other one — without this they would go on asking for a token that is
 * already there.
 */
export function watchSettings(
  onChange: (settings: Settings | null) => void,
): () => void {
  return stored.watch(onChange);
}
