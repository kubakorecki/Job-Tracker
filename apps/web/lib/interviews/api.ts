import { CreateInterview, Interview, UpdateInterview } from "@repo/schema";
import { jsonBody } from "../api/request";
import { errorResponse } from "../api/response";
import type { CurrentUser } from "../auth/current-user";
import { isJobApplicationId } from "../job-applications/api";
import { describeIssues } from "../zod-issues";
import { addInterview, deleteInterview, updateInterview } from "./repository";

/**
 * The Interview endpoints: arranging a meeting, correcting one, calling one off
 * and removing one recorded by mistake.
 *
 * There is no endpoint that reads them. A Job Application carries its
 * Interviews (`JobApplication.interviews`), which is the one read a client
 * makes and the one every surface draws from — a second address answering the
 * same list is a second thing to keep in step, and the page that shows the
 * meetings is already holding the Job Application they are on.
 *
 * Nothing here touches the Status. Arranging a meeting asks the user whether to
 * move the Job Application, and the answer is an ordinary patch on the Job
 * Application from the client that asked the question (ADR-0011) — so an
 * endpoint that arranged a meeting and moved a Status would be deciding on the
 * user's behalf exactly what ADR-0011 refuses to.
 *
 * The address names the Job Application as well as the meeting, because a
 * meeting belongs to one recruitment: it is what makes a correction addressed
 * at one Job Application unable to land on another's Interview, and it is the
 * arrangement the Coverage endpoints make for a Requirement.
 */

/** Which Job Application the meetings hang off. */
export type InterviewCollectionParams = { id: string };

/** Which meeting, on which Job Application, is being spoken about. */
export type InterviewParams = { id: string; interviewId: string };

/**
 * `POST /api/job-applications/:id/interviews`, carrying a day and the user's
 * own word for the stage at minimum.
 *
 * A 201 with the meeting, because a Job Application holds several and this is
 * one more of them — unlike the Tailored CV, where there is one at one address
 * and attaching replaces it.
 */
export async function addInterviewResponse(
  request: Request,
  user: CurrentUser,
  { id }: InterviewCollectionParams,
): Promise<Response> {
  if (!isJobApplicationId(id)) return noJobApplication();

  const read = await jsonBody(request);
  if ("refusal" in read) return read.refusal;

  const input = CreateInterview.safeParse(read.body);
  if (!input.success) {
    return errorResponse(
      "That is not a meeting that can be recorded.",
      400,
      describeIssues(input.error),
    );
  }

  const added = await addInterview(user.id, id, input.data);

  // Somebody else's Job Application and one that does not exist are the same
  // answer, so that the API never confirms a stranger's row is real.
  return added === null
    ? noJobApplication()
    : Response.json(added, { status: 201 });
}

/**
 * `PATCH /api/job-applications/:id/interviews/:interviewId`, carrying any
 * subset of an Interview's fields.
 *
 * Calling a meeting off arrives here like any other change, as
 * `{ cancelled: true }`. It is not an address of its own because a cancelled
 * meeting keeps its place and every detail it had (`CONTEXT.md`), which is
 * exactly what a patch of one field does and what a dedicated endpoint would
 * have to be careful not to undo.
 */
export async function updateInterviewResponse(
  request: Request,
  user: CurrentUser,
  params: InterviewParams,
): Promise<Response> {
  if (!addressesAnInterview(params)) return notFound();

  const read = await jsonBody(request);
  if ("refusal" in read) return read.refusal;

  const patch = UpdateInterview.safeParse(read.body);
  if (!patch.success) {
    return errorResponse(
      "That change is not valid.",
      400,
      describeIssues(patch.error),
    );
  }

  const updated = await updateInterview(
    user.id,
    params.id,
    params.interviewId,
    patch.data,
  );

  return updated === null ? notFound() : Response.json(updated);
}

/**
 * `DELETE /api/job-applications/:id/interviews/:interviewId`. For a meeting
 * recorded by mistake — a meeting the employer called off is cancelled rather
 * than deleted, which is what keeps it in the month's Activity Report.
 *
 * A second delete is a 404, as it is on a Job Application: by then there is
 * nothing there to be the caller's.
 */
export async function deleteInterviewResponse(
  _request: Request,
  user: CurrentUser,
  params: InterviewParams,
): Promise<Response> {
  if (!addressesAnInterview(params)) return notFound();

  const deleted = await deleteInterview(user.id, params.id, params.interviewId);

  return deleted ? new Response(null, { status: 204 }) : notFound();
}

/**
 * Whether the address could name one of this user's Interviews at all. An id
 * that could never be one is turned away here rather than reaching Postgres as
 * a cast error, exactly as the Job Application endpoints turn one away.
 */
function addressesAnInterview({ id, interviewId }: InterviewParams): boolean {
  return (
    isJobApplicationId(id) && Interview.shape.id.safeParse(interviewId).success
  );
}

/**
 * Where there is no meeting to speak of yet, the Job Application is what the
 * caller got wrong — a stranger's, a mistyped one, or one they have since
 * deleted — and it is the same answer for all three.
 */
function noJobApplication(): Response {
  return errorResponse("No such Job Application.", 404);
}

/**
 * Somebody else's Interview, one on another Job Application, and one that does
 * not exist are all the same answer, so that the API never confirms a
 * stranger's row is real.
 */
function notFound(): Response {
  return errorResponse("No such Interview.", 404);
}
