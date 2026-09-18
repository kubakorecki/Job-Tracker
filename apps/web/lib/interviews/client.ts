import type { CreateInterview, Interview, UpdateInterview } from "@repo/schema";
import { send } from "../api/client";

/**
 * The Interview endpoints, as the Job Application page addresses them. Each
 * function takes the shared contract's type, which is the same type the
 * endpoint validates against; how a request is sent and how a refusal is read
 * is `../api/client`'s business.
 *
 * There is nothing here that reads them: the meetings arrive with the Job
 * Application the page was rendered from, and every write answers with the
 * meeting it wrote, so the page never has to go and look for the list again.
 */

function collection(jobApplicationId: string): string {
  return `/api/job-applications/${jobApplicationId}/interviews`;
}

/** Arranges a meeting, and answers with it as the server recorded it. */
export async function postInterview(
  jobApplicationId: string,
  interview: CreateInterview,
): Promise<Interview> {
  return send(collection(jobApplicationId), {
    method: "POST",
    body: interview,
  });
}

/**
 * Corrects one meeting — a rescheduled day, a time since confirmed, a note
 * after it, or the cancellation, which is a change like any other.
 */
export async function patchInterview(
  jobApplicationId: string,
  interviewId: string,
  patch: UpdateInterview,
): Promise<Interview> {
  return send(`${collection(jobApplicationId)}/${interviewId}`, {
    method: "PATCH",
    body: patch,
  });
}

/** Removes a meeting recorded by mistake. Calling one off is a patch, above. */
export async function deleteInterview(
  jobApplicationId: string,
  interviewId: string,
): Promise<void> {
  return send(`${collection(jobApplicationId)}/${interviewId}`, {
    method: "DELETE",
  });
}
