import type { JobApplication } from "@repo/schema";
import type { Settings } from "./settings";

/**
 * How the panel addresses one Job Tracker: the API calls it makes, and the
 * dashboard pages it links to. Every request is cross-origin — the panel runs
 * on a `chrome-extension://` origin — and carries a Personal Access Token
 * rather than a cookie, which is exactly the pair the API's CORS layer allows
 * and its current-user resolver reads.
 *
 * Nothing here throws. A panel that cannot reach its API is something the
 * shell renders, not an exception, and a refused token is something it acts
 * on, so both come back as answers.
 */

/** How many Job Applications the panel shows. */
const RECENT_LIMIT = 5;

/**
 * What the API answered when asked for the most recent Job Applications. A
 * refused token is its own answer rather than one more message, because it is
 * the only failure the panel does something about: it sends the user back to
 * the setup form. Everything else it can only report.
 *
 * The discriminant is `kind` and not `status`, which in this project is where
 * a Job Application sits in the pipeline (`CONTEXT.md`) — and the panel puts
 * one of those next to each row of this very list.
 */
export type RecentOutcome =
  | { kind: "ready"; jobApplications: JobApplication[] }
  | { kind: "token-rejected" }
  | { kind: "failed"; problem: string };

export async function fetchRecentJobApplications(
  settings: Settings,
): Promise<RecentOutcome> {
  let response: Response;

  try {
    response = await fetch(`${settings.apiBaseUrl}/api/job-applications`, {
      headers: { authorization: `Bearer ${settings.token}` },
    });
  } catch {
    return {
      kind: "failed",
      problem: `Could not reach ${settings.apiBaseUrl}. Check the API base URL, and that the dashboard is running.`,
    };
  }

  // The one status with a meaning of its own: every endpoint answers 401 to a
  // token that is missing, mistyped, revoked, or minted by another deployment.
  if (response.status === 401) return { kind: "token-rejected" };

  if (!response.ok) {
    return { kind: "failed", problem: await refusal(response) };
  }

  const wrongShape = {
    kind: "failed",
    problem: `${settings.apiBaseUrl} did not answer with a list of Job Applications. Check that the API base URL points at the dashboard.`,
  } as const;

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return wrongShape;
  }

  // Checked rather than asserted: a base URL that reaches some other server
  // can answer 200 with anything at all, and the panel should say so instead
  // of rendering rows out of it.
  if (!Array.isArray(body)) return wrongShape;

  // The endpoint answers newest-first and this is a personal tracker of
  // hundreds of rows, so the five are taken here rather than teaching the API
  // a page size that only the panel would ever ask for.
  return {
    kind: "ready",
    jobApplications: (body as JobApplication[]).slice(0, RECENT_LIMIT),
  };
}

/**
 * The dashboard pages the panel sends the user to. They sit beside the API's
 * own address because both are ways of addressing one Job Tracker: when a
 * dashboard route moves, this is the file that knows about it — the same
 * reason `apps/web/lib/job-applications/client.ts` holds nothing but
 * addresses.
 */
export function dashboardPage(apiBaseUrl: string): string {
  return `${apiBaseUrl}/dashboard`;
}

export function tokensPage(apiBaseUrl: string): string {
  return `${apiBaseUrl}/settings/tokens`;
}

/**
 * What went wrong, in the endpoint's own words where it gave any. Every
 * refusal from this API carries an `error`; anything that does not is
 * something else answering on that address, and the status code is then all
 * there is to say.
 */
async function refusal(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `The API answered ${response.status}.`;
  } catch {
    return `The API answered ${response.status}.`;
  }
}
