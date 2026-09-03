import {
  CreateJobApplication,
  JobApplication,
  JobStatus,
  UpdateJobApplication,
} from "@repo/schema";
import type { CurrentUser } from "../auth/current-user";
import { errorResponse } from "../api/response";
import { describeIssues } from "../zod-issues";
import {
  createJobApplication,
  DuplicatePostingError,
  listJobApplications,
  updateJobApplication,
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

/**
 * `PATCH /api/job-applications/:id`, carrying any subset of a Job
 * Application's fields. Status arrives here like every other field: a
 * dedicated status endpoint would need this one's ownership check and its
 * applied-date rule, and the two would drift.
 */
export async function updateJobApplicationResponse(
  request: Request,
  user: CurrentUser,
  { id }: { id: string },
): Promise<Response> {
  // An id that could never be a Job Application's is answered the same way as
  // one that simply isn't the caller's, rather than reaching Postgres and
  // coming back as a cast error.
  if (!JobApplication.shape.id.safeParse(id).success) {
    return notFound();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Expected a JSON body.", 400);
  }

  const patch = UpdateJobApplication.safeParse(body);
  if (!patch.success) {
    return errorResponse(
      "That change is not valid.",
      400,
      describeIssues(patch.error),
    );
  }

  try {
    const updated = await updateJobApplication(user.id, id, patch.data);
    return updated === null ? notFound() : Response.json(updated);
  } catch (error) {
    if (error instanceof DuplicatePostingError) {
      return errorResponse(error.message, 409);
    }
    throw error;
  }
}

/**
 * Somebody else's Job Application is indistinguishable from one that does not
 * exist, so that the API never confirms a stranger's row is real.
 */
function notFound(): Response {
  return errorResponse("No such Job Application.", 404);
}
