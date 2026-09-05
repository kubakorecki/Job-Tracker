import { jsonBody } from "../api/request";
import { errorResponse } from "../api/response";
import type { CurrentUser } from "../auth/current-user";
import { MODEL_CALL_LIMIT_STATUS, spendModelCall } from "../model-calls/budget";
import { describeIssues } from "../zod-issues";
import {
  ACCEPTED_CV_FORMATS,
  CV_FIELD,
  CV_TOO_LARGE,
  CvMediaType,
  MAX_CV_BYTES,
  ProfileSkills,
  type ProfileOrNone,
  type UploadedCv,
} from "./contract";
import { readCvWithGemini, type CvReading, type ReadCv } from "./reader";
import { replaceProfileCv, setProfileSkills } from "./repository";
import { tidySkills } from "./skills";
import { supabaseCvStore, type CvStore } from "./storage";
import { profileFrom, readProfile } from "./view";

/**
 * The Profile endpoints, as plain request-to-response functions like the rest
 * of the API — except that they are built by factories, because the two things
 * a test substitutes here are not the user but the reader and the store.
 *
 * Between them they hold the whole of what an upload does: what a CV may be,
 * what a model call costs, what happens when a file cannot be read, the order
 * the file and the row are written in, and which half of a reading the user
 * has to say yes to before it is theirs.
 */

/** The file extensions each accepted format is recognised by, failing that. */
const EXTENSION_TYPES: Record<string, CvMediaType> = {
  pdf: "application/pdf",
  md: "text/markdown",
  markdown: "text/markdown",
  txt: "text/plain",
};

/**
 * `POST /api/profile`. Takes one CV as `multipart/form-data`, stores it as it
 * arrived, reads it, and makes it the user's Profile — replacing whatever was
 * there.
 *
 * Only half of what was read becomes the Profile. The document and its text
 * are the file's own and are written straight away; the skills are a Draft,
 * answered with and not stored, and they become the Profile's only when the
 * user sends them back to `PUT /api/profile/skills`. That is what lets a
 * mangled reading cost nothing but the upload, and what keeps a replacement
 * upload from quietly discarding corrections the user made by hand.
 *
 * Nothing is written until the file has been read. An unreadable file
 * therefore leaves the bucket and the existing Profile exactly as they were,
 * which is what makes "export a cleaner copy and try again" advice a user can
 * act on rather than a report of damage already done.
 *
 * The reader and the store are substitutable so the endpoint can be exercised
 * with no API key, no bucket and no network; nothing but a test passes either.
 */
export function uploadProfileResponse(
  read: ReadCv = readCvWithGemini,
  store: CvStore = supabaseCvStore,
) {
  return async (request: Request, user: CurrentUser): Promise<Response> => {
    const form = await formData(request);
    if (form === null) return errorResponse("Expected a file upload.", 400);

    const file = form.get(CV_FIELD);
    if (!(file instanceof File)) {
      return errorResponse(`Expected a CV in the "${CV_FIELD}" field.`, 400);
    }

    const mediaType = cvMediaTypeOf(file);
    if (mediaType === null) {
      return errorResponse(`A CV has to be ${ACCEPTED_CV_FORMATS}.`, 415, [
        `${file.name || "That file"} is not one of them.`,
      ]);
    }

    if (file.size > MAX_CV_BYTES) {
      return errorResponse(CV_TOO_LARGE, 413);
    }

    // Spent from the one daily budget every model call comes out of, and spent
    // before the reading rather than after, so a reading that reached a
    // provider counts whether or not it came back with anything. It is one
    // call per upload: what a PDF costs the model is what the allowance is
    // for, and a text file is not cheap enough to be worth a second rule.
    if ((await spendModelCall(user.id)) === "over-limit") {
      return errorResponse(
        "You have used today's allowance of model calls. Try again tomorrow.",
        MODEL_CALL_LIMIT_STATUS,
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    let reading: CvReading;
    try {
      reading = await read({ bytes, mediaType });
    } catch {
      // Every way of failing to reach or understand the provider — an outage,
      // an exhausted quota, a malformed reply — is the same answer here, and a
      // different one from a file that simply had no text in it: this one is
      // not the user's fault and their file is fine.
      return errorResponse(
        "The service that reads CVs could not be reached. Try again shortly.",
        502,
      );
    }

    const extractedText = reading.text;
    if (extractedText === "") {
      return errorResponse(
        "No text could be read from that file. If it is a scan or an image, export a cleaner copy and upload it again.",
        422,
      );
    }

    const storagePath = await store.put(user.id, { bytes, mediaType });
    const { profile, replaced } = await replaceProfileCv(user.id, {
      storagePath,
      fileName: fileNameOf(file, mediaType),
      mediaType,
      extractedText,
    });

    // The file it replaced goes only once the Profile has stopped pointing at
    // it. The other order would put a failure between the two writes, and the
    // Profile would be left naming a document that is no longer there.
    if (replaced !== null) await store.remove(user.id, replaced);

    const answer: UploadedCv = {
      profile: await profileFrom(profile, store),
      // Tidied here rather than in the reader, so that the list the user is
      // shown is the list the accept endpoint would keep — a proposal holding
      // a duplicate the accepted list would drop is a review of something
      // that cannot happen.
      proposedSkills: tidySkills(reading.skills),
    };

    // 200 rather than 201: the Profile is one thing at one address, always
    // reachable there, so an upload is a replacement whether or not there was
    // a CV before it.
    return Response.json(answer, { status: 200 });
  };
}

/**
 * `GET /api/profile`. The Profile, with a short-lived signed URL for the file,
 * or `null` for a user who has not uploaded one — an ordinary state rather
 * than a 404, so that a client is not made to read a first run as a failure.
 *
 * The URL is minted per read and expires, which is what lets the bucket stay
 * private.
 */
export function readProfileResponse(store: CvStore = supabaseCvStore) {
  return async (_request: Request, user: CurrentUser): Promise<Response> => {
    const profile: ProfileOrNone = await readProfile(user.id, store);

    return Response.json(profile);
  };
}

/**
 * `PUT /api/profile/skills`. Makes the user's skill list what they say it is.
 *
 * Accepting a Draft and editing the list months later are one request, because
 * they are one act: the user has looked at a list and said what it should be.
 * A separate accept endpoint would have to take a list the user may have
 * rewritten entirely, and would then be an edit wearing a different name — and
 * discarding needs no endpoint at all, since nothing persisted the proposal.
 *
 * The whole list is replaced rather than added to, so removing a skill is the
 * same request as adding one. Nothing here touches the document: the file and
 * its text have a different owner, and the two halves of a Profile are
 * deliberately not editable through each other.
 *
 * A plain function rather than a factory, unlike the two endpoints above:
 * there is nothing here for a test to substitute, because this one reaches no
 * provider and no bucket.
 */
export async function setProfileSkillsResponse(
  request: Request,
  user: CurrentUser,
): Promise<Response> {
  const read = await jsonBody(request);
  if ("refusal" in read) return read.refusal;

  const sent = ProfileSkills.safeParse(read.body);
  if (!sent.success) {
    return errorResponse(
      "That skill list is not valid.",
      400,
      describeIssues(sent.error),
    );
  }

  const row = await setProfileSkills(user.id, tidySkills(sent.data.skills));

  // A skill list belongs to a Profile, and a Profile begins with a CV. This is
  // a 404 rather than a quietly created row: a list with no document behind it
  // is not something an Analysis could ever measure against.
  if (row === null) {
    return errorResponse(
      "There is no Profile to put a skill list on. Upload a CV first.",
      404,
    );
  }

  const answer: ProfileSkills = { skills: row.skills };
  return Response.json(answer);
}

/**
 * What this file is, if it is a CV at all. The media type the browser declared
 * is believed when it is one of the three, and the file's own extension
 * answers when it is not: a `.md` file reaches a request as `text/markdown`,
 * as `text/plain`, or as nothing at all depending on the browser and the
 * operating system, and a user who exported a CV should not have to know which
 * of those they got.
 *
 * An extension is the fallback rather than the rule because it is the weaker
 * claim of the two — anything can be renamed. Neither is trusted further than
 * this: the reader is handed the bytes, and a file that is not what it says it
 * is comes back with no text.
 */
export function cvMediaTypeOf(file: File): CvMediaType | null {
  const declared = CvMediaType.safeParse(file.type.split(";")[0]?.trim());
  if (declared.success) return declared.data;

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TYPES[extension] ?? null;
}

/** The name to keep, or one of our own for a file that arrived without one. */
function fileNameOf(file: File, mediaType: CvMediaType): string {
  return file.name.trim() === "" ? `cv${extensionOf(mediaType)}` : file.name;
}

function extensionOf(mediaType: CvMediaType): string {
  const named = Object.entries(EXTENSION_TYPES).find(
    ([, type]) => type === mediaType,
  );

  return named === undefined ? "" : `.${named[0]}`;
}

/**
 * The request's form body, or `null` when it carries none. A body that will
 * not parse as a multipart upload is the client's mistake, and is worth saying
 * so before anything else gets a look at it — the same question `jsonBody`
 * asks of the endpoints that take JSON.
 */
async function formData(request: Request): Promise<FormData | null> {
  try {
    return await request.formData();
  } catch {
    return null;
  }
}
