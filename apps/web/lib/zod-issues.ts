import type { z } from "zod";

/**
 * A failed parse as one readable line per offending field. The add form and
 * the API both render these, so a validation failure reads the same whether it
 * was caught before the request or after it.
 */
export function describeIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) =>
    issue.path.length === 0
      ? issue.message
      : `${issue.path.join(".")}: ${issue.message}`,
  );
}
