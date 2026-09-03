import type { ApiError } from "./response";

/**
 * How the browser talks to this app's own API. Every request the dashboard
 * makes goes through here, so the shape of a refusal is read in one place —
 * and each feature's client module is left holding nothing but its addresses.
 */

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

export async function send<Result = void>(
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
  // the record it wrote.
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
