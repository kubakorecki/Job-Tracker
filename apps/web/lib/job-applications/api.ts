import {
  CreateJobApplication,
  JobApplication,
  JobStatus,
  UpdateJobApplication,
} from "@repo/schema";
import type { CurrentUser } from "../auth/current-user";
import { errorResponse } from "../api/response";
import { jsonBody } from "../api/request";
import { describeIssues } from "../zod-issues";
import {
  createJobApplication,
  deleteJobApplication,
  DuplicatePostingError,
  getJobApplication,
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
  const read = await jsonBody(request);
  if ("refusal" in read) return read.refusal;

  const input = CreateJobApplication.safeParse(read.body);
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
  if (!isJobApplicationId(id)) return notFound();

  const read = await jsonBody(request);
  if ("refusal" in read) return read.refusal;

  const patch = UpdateJobApplication.safeParse(read.body);
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
 * `GET /api/job-applications/:id`, the whole of one Job Application — every
 * field the detail view puts in front of the user, and every field it may
 * send back.
 */
export async function readJobApplicationResponse(
  _request: Request,
  user: CurrentUser,
  { id }: { id: string },
): Promise<Response> {
  if (!isJobApplicationId(id)) return notFound();

  const jobApplication = await getJobApplication(user.id, id);
  return jobApplication === null ? notFound() : Response.json(jobApplication);
}

/**
 * `DELETE /api/job-applications/:id`. The confirmation step lives in the
 * client — an endpoint asked to delete something has already been told twice.
 * A second delete of the same Job Application is a 404, because by then there
 * is nothing there to be the caller's.
 */
export async function deleteJobApplicationResponse(
  _request: Request,
  user: CurrentUser,
  { id }: { id: string },
): Promise<Response> {
  if (!isJobApplicationId(id)) return notFound();

  const deleted = await deleteJobApplication(user.id, id);
  return deleted ? new Response(null, { status: 204 }) : notFound();
}

/**
 * Whether the address could name a Job Application at all. An id that could
 * never be one is answered the same way as one that simply isn't the caller's,
 * rather than reaching Postgres and coming back as a cast error. The detail
 * page asks the same question before it reads, so a mistyped URL is a 404
 * there too.
 */
export function isJobApplicationId(id: string): boolean {
  return JobApplication.shape.id.safeParse(id).success;
}

/**
 * Somebody else's Job Application is indistinguishable from one that does not
 * exist, so that the API never confirms a stranger's row is real. It is the
 * one answer the read, the patch and the delete all give.
 */
function notFound(): Response {
  return errorResponse("No such Job Application.", 404);
}
