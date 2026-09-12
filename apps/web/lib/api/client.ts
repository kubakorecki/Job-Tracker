import type { ApiError } from "./response";

/**
 * How the browser talks to this app's own API. Every request the dashboard
 * makes goes through here, so the shape of a refusal is read in one place —
 * and each feature's client module is left holding nothing but its addresses.
 */

/** A refusal from the API, in the endpoint's own words. */
export class ApiRequestError extends Error {
  /**
   * Every problem the endpoint named, its own sentence first and then any
   * field it blamed — so a caller can render the list without asking which
   * kind of failure it was.
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

  if (!response.ok) throw await refusalIn(response);

  // A delete answers 204 and says nothing more; everything else answers with
  // the record it wrote.
  return response.status === 204 ? (undefined as Result) : response.json();
}

/**
 * A file, as `multipart/form-data`. Beside `send` rather than inside it
 * because the two want opposite things of a body: `send` serialises its own
 * and declares a content type, and a `FormData` must reach `fetch` untouched
 * and unannounced so that the browser can write the boundary itself.
 *
 * A refusal is read the same way, which is the whole reason this is here and
 * not in the one feature that uploads anything.
 */
export async function upload<Result>(
  url: string,
  body: FormData,
): Promise<Result> {
  const response = await fetch(url, { method: "POST", body });

  if (!response.ok) throw await refusalIn(response);

  return response.json();
}

/**
 * An unsuccessful response as the error every client in this app throws.
 *
 * Beside `send` rather than inside it because one response in the app is not a
 * JSON document: a Conversation turn is read as a stream, so it cannot go
 * through `send` — but a turn that was refused is refused in exactly the same
 * shape as everything else, and reading that shape twice is how the panel
 * comes to report a spent allowance differently from the rest of the app.
 */
export async function refusalIn(response: Response): Promise<ApiRequestError> {
  return new ApiRequestError(await problems(response));
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
 * What went wrong, in the endpoint's own account of it: a duplicate Posting,
 * an expired session and a rejected field read very differently, and this list
 * is the only place the user sees the difference.
 */
async function problems(response: Response): Promise<string[]> {
  try {
    return problemsIn(await response.json());
  } catch {
    return [`The server answered ${response.status}.`];
  }
}

/**
 * A refusal as the lines to put in front of the user: what the endpoint said
 * went wrong, and then each field it blamed.
 *
 * Both, rather than the fields where there are fields. The two halves answer
 * different questions — `error` is the rule, `issues` is what broke it — and a
 * client that showed only the second would tell someone their file "is not one
 * of them" without ever saying what the ones are.
 *
 * Exported for its test; nothing but `problems` calls it.
 */
export function problemsIn(failure: ApiError): string[] {
  // Keyed by its own text where it is rendered, and an endpoint that put its
  // sentence in both halves has named one problem rather than two.
  return [...new Set([failure.error, ...(failure.issues ?? [])])];
}
