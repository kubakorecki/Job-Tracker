import type {
  CreateJobApplication,
  JobApplication,
  UpdateJobApplication,
} from "@repo/schema";
import type { ApiError } from "../api/response";

/**
 * How the browser talks to the Job Applications endpoints. Every request the
 * dashboard makes goes through here, so the endpoint's address and the shape
 * of its refusals are written once — and each function takes the shared
 * contract's type, which is the same type the endpoint validates against.
 */

const ENDPOINT = "/api/job-applications";

/** A refusal from the API, in the endpoint's own words. */
export class ApiRequestError extends Error {
  /**
   * Every problem the endpoint named. A validation failure lists one line per
   * offending field; everything else is the single message repeated here, so a
   * caller can render the list without asking which kind of failure it was.
   */
  readonly problems: string[];

  constructor(problems: string[]) {
    super(problems[0] ?? "The request was refused.");
    this.name = "ApiRequestError";
    this.problems = problems;
  }
}

export async function fetchJobApplications(): Promise<JobApplication[]> {
  return send(ENDPOINT);
}

export async function postJobApplication(
  input: CreateJobApplication,
): Promise<JobApplication> {
  return send(ENDPOINT, { method: "POST", body: input });
}

export async function patchJobApplication(
  id: string,
  patch: UpdateJobApplication,
): Promise<JobApplication> {
  return send(`${ENDPOINT}/${id}`, { method: "PATCH", body: patch });
}

/** Removing a Job Application. The confirmation step is the caller's. */
export async function deleteJobApplication(id: string): Promise<void> {
  await send(`${ENDPOINT}/${id}`, { method: "DELETE" });
}

async function send<Result = void>(
  url: string,
  request: { method: string; body?: unknown } | undefined = undefined,
): Promise<Result> {
  const response = await fetch(
    url,
    request === undefined
      ? undefined
      : {
          method: request.method,
          ...(request.body === undefined
            ? {}
            : {
                headers: { "content-type": "application/json" },
                body: JSON.stringify(request.body),
              }),
        },
  );

  if (!response.ok) throw new ApiRequestError(await problems(response));

  // A delete answers 204 and says nothing more; everything else answers with
  // the Job Application it wrote.
  return response.status === 204 ? (undefined as Result) : response.json();
}

/**
 * What a caught failure amounts to, in the endpoint's own words where it gave
 * any. A request that never arrived has none, and says so.
 */
export function describeFailure(error: unknown): string[] {
  return error instanceof ApiRequestError
    ? error.problems
    : ["Could not reach the server. Try again."];
}

/**
 * What went wrong, preferring the endpoint's own account of it: a duplicate
 * Posting, an expired session and a rejected field read very differently, and
 * the retry message is the only place the user sees the difference.
 */
async function problems(response: Response): Promise<string[]> {
  try {
    const failure: ApiError = await response.json();
    return failure.issues ?? [failure.error];
  } catch {
    return [`The server answered ${response.status}.`];
  }
}
