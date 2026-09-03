import { errorResponse } from "./response";

/**
 * Reading a request. Every endpoint that takes a body asks the same question
 * of it and refuses in the same words, so the question is asked here once.
 */

/**
 * The request's JSON body, or the refusal to answer with when it carries none.
 * A body that will not parse is the client's mistake, and is worth saying so
 * before any schema gets a look at it.
 */
export async function jsonBody(
  request: Request,
): Promise<{ body: unknown } | { refusal: Response }> {
  try {
    return { body: await request.json() };
  } catch {
    return { refusal: errorResponse("Expected a JSON body.", 400) };
  }
}
