/**
 * The one error shape every endpoint answers with, so a client can read a
 * failure without knowing which endpoint produced it. `issues` is present only
 * when the request body was the problem, and names the offending fields.
 */
export type ApiError = {
  error: string;
  issues?: string[];
};

export function errorResponse(
  error: string,
  status: number,
  issues?: string[],
): Response {
  const body: ApiError = issues === undefined ? { error } : { error, issues };
  return Response.json(body, { status });
}
