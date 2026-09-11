import { errorResponse } from "../api/response";
import type { CurrentUser } from "../auth/current-user";
import { isJobApplicationId } from "../job-applications/api";
import { getJobApplication } from "../job-applications/repository";
import { MODEL_CALL_LIMIT_STATUS, spendModelCall } from "../model-calls/budget";
import {
  readCvWithGemini,
  type CvReading,
  type ReadCv,
} from "../profile/reader";
import { supabaseCvStore, type CvStore } from "../profile/storage";
import { cvFrom } from "../profile/upload";
import type { TailoredCv, TailoredCvOrNone } from "./contract";
import { detachTailoredCv, replaceTailoredCv } from "./repository";
import { readTailoredCv, tailoredCvFrom } from "./view";

/**
 * The Tailored CV endpoints: attaching the document the user is actually
 * sending for one job, reading it back, and taking it off again.
 *
 * They are the Profile's upload with one difference and one omission. The
 * difference is where the document lands — on one Job Application rather than
 * on the user — and the omission is the Draft: a reading proposes skills, and
 * a Tailored CV has nowhere to put them. There is exactly one skill list, it is
 * the user's own side of the comparison, and a CV written for one job is not a
 * claim about what they can do.
 *
 * What the reading is kept for is the text. A Tailored CV is a Basis — "does
 * what I am sending show it?" as against "do I have this?" (ADR-0004) — and a
 * document nothing can read cannot be one, which is why an unreadable file is
 * refused here exactly as it is on the Profile rather than filed away as bytes.
 *
 * The reader and the store are substitutable so the endpoints can be exercised
 * with no API key, no bucket and no network; nothing but a test passes either.
 */

/** Which Job Application the CV is attached to. */
export type TailoredCvParams = { id: string };

/**
 * `POST /api/job-applications/:id/cv`. Takes one CV as `multipart/form-data`,
 * stores it as it arrived, reads it, and attaches it to this Job Application —
 * replacing whatever was attached before.
 *
 * Nothing is written until the file has been read, as on the Profile: an
 * unreadable file leaves the bucket and the attachment exactly as they were,
 * which is what makes "export a cleaner copy and try again" advice the user can
 * act on rather than a report of damage already done.
 */
export function attachTailoredCvResponse(
  read: ReadCv = readCvWithGemini,
  store: CvStore = supabaseCvStore,
) {
  return async (
    request: Request,
    user: CurrentUser,
    { id }: TailoredCvParams,
  ): Promise<Response> => {
    if (!isJobApplicationId(id)) return notFound();
    if ((await getJobApplication(user.id, id)) === null) return notFound();

    const arrived = await cvFrom(request);
    if ("refusal" in arrived) return arrived.refusal;

    const { bytes, mediaType, fileName } = arrived.cv;

    // Spent from the one daily budget every model call comes out of, and spent
    // before the reading rather than after, so a reading that reached a
    // provider counts whether or not it came back with anything. Everything
    // refused above this line costs nothing at all.
    if ((await spendModelCall(user.id)) === "over-limit") {
      return errorResponse(
        "You have used today's allowance of model calls. Try again tomorrow.",
        MODEL_CALL_LIMIT_STATUS,
      );
    }

    let reading: CvReading;
    try {
      reading = await read({ bytes, mediaType });
    } catch {
      // Every way of failing to reach or understand the provider — an outage,
      // an exhausted quota, a malformed reply — is one answer, and a different
      // one from a file that simply had no text in it: this one is not the
      // user's fault and their file is fine.
      return errorResponse(
        "The service that reads CVs could not be reached. Try again shortly.",
        502,
      );
    }

    // Only the text is kept. The same call also proposes skills, because the
    // reader asks one question of one document — and they are dropped here
    // rather than stored anywhere, since the skill list belongs to the Profile
    // and there is exactly one of it. A reading that asked for the transcript
    // alone is the obvious saving, and it is the Analysis effort's to make.
    const extractedText = reading.text;
    if (extractedText === "") {
      return errorResponse(
        "No text could be read from that file. If it is a scan or an image, export a cleaner copy and upload it again.",
        422,
      );
    }

    const storagePath = await store.put(user.id, { bytes, mediaType });
    const { tailoredCv, replaced } = await replaceTailoredCv(user.id, id, {
      storagePath,
      fileName,
      mediaType,
      extractedText,
    });

    // The file it replaced goes only once nothing points at it. The other order
    // would put a failure between the two writes, and the Job Application would
    // be left naming a document that is no longer there.
    if (replaced !== null) await store.remove(user.id, replaced);

    const answer: TailoredCv = await tailoredCvFrom(tailoredCv, store);

    // 200 rather than 201: there is one Tailored CV at one address, always
    // reachable there, so attaching is a replacement whether or not there was
    // one before it.
    return Response.json(answer, { status: 200 });
  };
}

/**
 * `GET /api/job-applications/:id/cv`. The Tailored CV, with a short-lived
 * signed URL for the file, or `null` where none is attached — the ordinary
 * state, in which the Profile is what the user would be sending.
 *
 * The URL is minted per read and expires, which is what lets the bucket stay
 * private, and why a page open longer than that asks again rather than showing
 * a frame that will not load.
 */
export function readTailoredCvResponse(store: CvStore = supabaseCvStore) {
  return async (
    _request: Request,
    user: CurrentUser,
    { id }: TailoredCvParams,
  ): Promise<Response> => {
    if (!isJobApplicationId(id)) return notFound();
    if ((await getJobApplication(user.id, id)) === null) return notFound();

    const tailoredCv: TailoredCvOrNone = await readTailoredCv(
      user.id,
      id,
      store,
    );

    return Response.json(tailoredCv);
  };
}

/**
 * `DELETE /api/job-applications/:id/cv`. Takes the document off the Job
 * Application and out of the bucket, leaving the Profile to stand in for what
 * the user would send.
 *
 * The file goes for good. That is the honest reading of the gesture — the user
 * is saying this is not what they are sending — and keeping an unreferenced
 * document in a private bucket to be safe would be keeping it forever, since
 * nothing would ever point at it again to find it.
 */
export function detachTailoredCvResponse(store: CvStore = supabaseCvStore) {
  return async (
    _request: Request,
    user: CurrentUser,
    { id }: TailoredCvParams,
  ): Promise<Response> => {
    if (!isJobApplicationId(id)) return notFound();
    if ((await getJobApplication(user.id, id)) === null) return notFound();

    const detached = await detachTailoredCv(user.id, id);

    // A second detach is a 404, as a second delete of a Job Application is: by
    // then there is nothing there to be the caller's.
    if (detached === null) {
      return errorResponse(
        "There is no CV attached to this Job Application.",
        404,
      );
    }

    // Only once the row has stopped pointing at it, so a failure here leaves an
    // unreferenced object rather than an attachment naming a document that has
    // gone.
    await store.remove(user.id, detached);

    return new Response(null, { status: 204 });
  };
}

/**
 * Somebody else's Job Application and one that does not exist are the same
 * answer, so that the API never confirms a stranger's row is real. It is also
 * the answer a stranger gets for the CV attached to one, which is the whole of
 * what keeps a private document private here.
 */
function notFound(): Response {
  return errorResponse("No such Job Application.", 404);
}
