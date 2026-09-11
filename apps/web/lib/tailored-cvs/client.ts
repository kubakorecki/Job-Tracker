import { send, upload } from "../api/client";
import { CV_FIELD } from "../profile/contract";
import type { TailoredCv, TailoredCvOrNone } from "./contract";

/**
 * The Tailored CV endpoints, as the Job Application page addresses them. One
 * address, three verbs: attach a document, read it back for a fresh link, take
 * it off again.
 */

function endpoint(jobApplicationId: string): string {
  return `/api/job-applications/${jobApplicationId}/cv`;
}

/**
 * Attaches this file to the Job Application, replacing whatever was attached,
 * and answers with the Tailored CV as it now stands.
 *
 * It waits on a model call — the document is read so that there is text to
 * compare against — and the page is expected to say so while it is in flight.
 */
export async function attachTailoredCv(
  jobApplicationId: string,
  file: File,
): Promise<TailoredCv> {
  const body = new FormData();
  body.set(CV_FIELD, file);

  return upload(endpoint(jobApplicationId), body);
}

/**
 * The Tailored CV attached to this Job Application, or `null` where none is —
 * an ordinary answer rather than a failure.
 *
 * Read again for a fresh link: the URL one carries is signed and short-lived,
 * so a page open longer than that has to ask for another before the document
 * will open.
 */
export async function fetchTailoredCv(
  jobApplicationId: string,
): Promise<TailoredCvOrNone> {
  return send(endpoint(jobApplicationId));
}

/** Takes the document off the Job Application, and out of the bucket. */
export async function detachTailoredCv(
  jobApplicationId: string,
): Promise<void> {
  return send(endpoint(jobApplicationId), { method: "DELETE" });
}
