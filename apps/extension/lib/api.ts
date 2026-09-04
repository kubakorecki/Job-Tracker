import {
  ExtractJobResponse,
  type CreateJobApplication,
  type ExtractJobRequest,
  type ExtractionFailureReason,
  type JobApplication,
  type JobExtraction,
  type UpdateJobApplication,
} from "@repo/schema";
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

/**
 * The two ways a call can end short of the endpoint answering the question it
 * was asked. A refused token is its own member rather than one more message,
 * because it is the only failure the panel *does* something about: it sends
 * the user back to the setup form. Everything else it can only report.
 *
 * Every call below can end either way, so every outcome union here is made of
 * its own answers plus these two, and the panel handles them once.
 *
 * The discriminant is `kind` and not `status`, which in this project is where
 * a Job Application sits in the pipeline (`CONTEXT.md`) — and the panel puts
 * one of those next to each row of the recent list.
 */
export type CallFailure =
  { kind: "token-rejected" } | { kind: "failed"; problems: string[] };

/** What the API answered when asked for Job Applications. */
export type ListOutcome =
  { kind: "ready"; jobApplications: JobApplication[] } | CallFailure;

/**
 * The user's Job Applications, newest first. The panel shows a handful of
 * them, but it asks for all of them and takes what it needs: the near-
 * duplicate hint (ADR-0002) has to look at every Job Application at a company
 * and not merely the last five, and this is a personal tracker of hundreds of
 * rows — a page size only the panel would ever ask for would be a thing to
 * teach the API for no gain.
 */
export async function fetchJobApplications(
  settings: Settings,
): Promise<ListOutcome> {
  return listing(settings, "/api/job-applications");
}

/**
 * The Job Application the user already saved for this Posting, if there is
 * one. This is the lookup ADR-0002 asks the extension to make before it
 * extracts, and the API is what normalizes the URL — the panel sends the
 * address of the tab exactly as it found it, tracking parameters and all.
 *
 * A Posting that is not saved is an empty list, not a refusal, so nothing here
 * has to read a status code as an answer.
 */
export type LookUpOutcome =
  { kind: "looked-up"; jobApplication: JobApplication | null } | CallFailure;

export async function lookUpPosting(
  settings: Settings,
  url: string,
): Promise<LookUpOutcome> {
  const outcome = await listing(
    settings,
    `/api/job-applications?url=${encodeURIComponent(url)}`,
  );

  return outcome.kind === "ready"
    ? { kind: "looked-up", jobApplication: outcome.jobApplications[0] ?? null }
    : outcome;
}

/** One request that should come back as a list of Job Applications. */
async function listing(settings: Settings, path: string): Promise<ListOutcome> {
  const asked = await ask(settings, path);
  if ("failure" in asked) return asked.failure;

  const { response } = asked;
  if (!response.ok) {
    return { kind: "failed", problems: await refusal(response) };
  }

  const wrongShape: ListOutcome = {
    kind: "failed",
    problems: [
      `${settings.apiBaseUrl} did not answer with a list of Job Applications. Check that the API base URL points at the dashboard.`,
    ],
  };

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

  return { kind: "ready", jobApplications: body as JobApplication[] };
}

/**
 * What the extraction endpoint answered, flattened into the same shape as
 * every other call here: its own answers, plus the two ways any call can end.
 *
 * The reason is carried through in the contract's own words rather than
 * re-spelt in the panel's. Both surfaces compile against `@repo/schema`, so a
 * translation here would only mean the same three cases were switched on
 * twice — once to rename them, once to act on them.
 */
export type ExtractOutcome =
  | { kind: "extracted"; draft: JobExtraction }
  | { kind: "not-extracted"; reason: ExtractionFailureReason }
  | CallFailure;

/**
 * Asks what a page says about a job. Two of the endpoint's three refusals
 * answer 200 and the third answers 429, so the body is what is read here and
 * the status is not consulted until the body has failed to be an extraction.
 *
 * That body is parsed against the contract rather than asserted: a base URL
 * that reaches some other server can answer 200 with anything, and the panel
 * would otherwise open a review form full of whatever it found.
 */
export async function extractJob(
  settings: Settings,
  request: ExtractJobRequest,
): Promise<ExtractOutcome> {
  const asked = await ask(settings, "/api/extract-job", { body: request });
  if ("failure" in asked) return asked.failure;

  const { response } = asked;

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: "failed", problems: [nothingButStatus(response.status)] };
  }

  const extraction = ExtractJobResponse.safeParse(body);
  if (!extraction.success) {
    // A refusal this endpoint never promised — a rejected request body, a
    // crash — lands here too, and its own words are better than a complaint
    // about the shape of them.
    return {
      kind: "failed",
      problems: response.ok
        ? [
            `${settings.apiBaseUrl} did not answer with an extraction. Check that the API base URL points at the dashboard.`,
          ]
        : problemsIn(body, response.status),
    };
  }

  return extraction.data.ok
    ? { kind: "extracted", draft: extraction.data.draft }
    : { kind: "not-extracted", reason: extraction.data.reason };
}

/** What saving the review form did. */
export type SaveOutcome =
  { kind: "saved"; jobApplication: JobApplication } | CallFailure;

/**
 * Records a Job Application. It is the endpoint the dashboard's own add form
 * posts to, taking the same contract type — so a job captured in the panel and
 * one typed on the dashboard are the same write, validated by the same schema,
 * and land in the one place the board reads from.
 */
export async function saveJobApplication(
  settings: Settings,
  input: CreateJobApplication,
): Promise<SaveOutcome> {
  const asked = await ask(settings, "/api/job-applications", { body: input });
  if ("failure" in asked) return asked.failure;

  const { response } = asked;
  if (!response.ok) {
    return { kind: "failed", problems: await refusal(response) };
  }

  return {
    kind: "saved",
    jobApplication: (await response.json()) as JobApplication,
  };
}

/**
 * Changes a Job Application the user already has — which, from the panel, is
 * only ever its Status. Everything else about an already-saved Posting is
 * edited in the dashboard: the panel's job on one is to say what the user has
 * and let them move it along, not to be a second editor of the same record.
 *
 * It answers with the same outcome a save does, because the panel does the
 * same two things with it: show the Job Application as it now stands, or say
 * what stopped it.
 */
export async function patchJobApplication(
  settings: Settings,
  id: string,
  patch: UpdateJobApplication,
): Promise<SaveOutcome> {
  const asked = await ask(settings, `/api/job-applications/${id}`, {
    method: "PATCH",
    body: patch,
  });
  if ("failure" in asked) return asked.failure;

  const { response } = asked;
  if (!response.ok) {
    return { kind: "failed", problems: await refusal(response) };
  }

  return {
    kind: "saved",
    jobApplication: (await response.json()) as JobApplication,
  };
}

/**
 * One request to this panel's Job Tracker, with the token on it. It answers
 * with the response, or with the failure that means there is no response worth
 * reading — an address nothing is listening on, and a token the API will not
 * accept whatever it was asked for.
 *
 * Every other status comes back as a response, because what a status means is
 * the endpoint's business: 429 is a refusal to the caller asking for a list
 * and a documented answer to the caller asking for an extraction.
 *
 * A body makes it a write, and `POST` is what a write is unless the caller
 * says otherwise — the one that does is the Status change, which is a PATCH.
 */
async function ask(
  settings: Settings,
  path: string,
  write?: { method?: "POST" | "PATCH"; body: unknown },
): Promise<{ response: Response } | { failure: CallFailure }> {
  let response: Response;

  try {
    response = await fetch(`${settings.apiBaseUrl}${path}`, {
      headers: {
        authorization: `Bearer ${settings.token}`,
        ...(write === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(write === undefined
        ? {}
        : {
            method: write.method ?? "POST",
            body: JSON.stringify(write.body),
          }),
    });
  } catch {
    return {
      failure: {
        kind: "failed",
        problems: [
          `Could not reach ${settings.apiBaseUrl}. Check the API base URL, and that the dashboard is running.`,
        ],
      },
    };
  }

  // The one status with a meaning of its own: every endpoint answers 401 to a
  // token that is missing, mistyped, revoked, or minted by another deployment.
  if (response.status === 401) return { failure: { kind: "token-rejected" } };

  return { response };
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
 * Where an already-saved Job Application is edited. The panel shows what the
 * user has and moves its Status; everything else about it lives on this page,
 * which is the whole of the reason there is no second editor in the panel.
 */
export function jobApplicationPage(apiBaseUrl: string, id: string): string {
  return `${apiBaseUrl}/dashboard/job-applications/${id}`;
}

/**
 * What went wrong, in the endpoint's own words where it gave any. A refusal
 * from this API carries an `error`, and a rejected body carries one `issues`
 * line per offending field — which is why this is a list: the review form has
 * a box per field, and a single sentence would have to speak for all of them.
 */
async function refusal(response: Response): Promise<string[]> {
  try {
    return problemsIn(await response.json(), response.status);
  } catch {
    return [nothingButStatus(response.status)];
  }
}

/**
 * The same reading, for a caller that already has the body in its hand. The
 * extraction endpoint answers some of its own failures with 200, so its body
 * is read before its status is judged and there is nothing left to re-read.
 *
 * A body carrying neither field is something other than this API answering on
 * that address, and the status code is then all there is to say.
 */
function problemsIn(body: unknown, status: number): string[] {
  const failure = body as { error?: string; issues?: string[] } | null;

  if (failure?.issues !== undefined) return failure.issues;
  return [failure?.error ?? nothingButStatus(status)];
}

/** All there is to say about a refusal that said nothing for itself. */
function nothingButStatus(status: number): string {
  return `The API answered ${status}.`;
}
