import { CreateJobApplication, JobStatus } from "@repo/schema";
import type { CurrentUser } from "../auth/current-user";
import { errorResponse } from "../api/response";
import { describeIssues } from "../zod-issues";
import {
  createJobApplication,
  DuplicatePostingError,
  listJobApplications,
} from "./repository";

/**
 * The Job Applications endpoints, as plain request-to-response functions. They
 * are the seam nearly everything about the backend is tested through, so they
 * hold the whole of a request's behaviour — validation, the shape of a
 * response, the status code — and delegate only the queries.
 */

/** `GET /api/job-applications`, optionally `?status=applied`. */
export async function listJobApplicationsResponse(
  request: Request,
  user: CurrentUser,
): Promise<Response> {
  const requested = new URL(request.url).searchParams.get("status");

  if (requested === null) {
    return Response.json(await listJobApplications(user.id));
  }

  const status = JobStatus.safeParse(requested);
  if (!status.success) {
    return errorResponse(
      `Unknown status "${requested}". Expected one of: ${JobStatus.options.join(", ")}.`,
      400,
    );
  }

  return Response.json(
    await listJobApplications(user.id, { status: status.data }),
  );
}

/** `POST /api/job-applications`, wanting a company and a job title at minimum. */
export async function createJobApplicationResponse(
  request: Request,
  user: CurrentUser,
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Expected a JSON body.", 400);
  }

  const input = CreateJobApplication.safeParse(body);
  if (!input.success) {
    return errorResponse(
      "That Job Application is not valid.",
      400,
      describeIssues(input.error),
    );
  }

  try {
    const created = await createJobApplication(user.id, input.data);
    return Response.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof DuplicatePostingError) {
      return errorResponse(error.message, 409);
    }
    throw error;
  }
}
