import {
  AI_USAGE_LIMIT_STATUS,
  AI_USAGE_SPENT_MESSAGE,
  mayStartAiCall,
} from "../ai-usage/meter";
import { tokensSpentBy, type Metered } from "../ai-usage/metered";
import { recordAiUsage } from "../ai-usage/repository";
import { jsonBody } from "../api/request";
import { errorResponse } from "../api/response";
import type { CurrentUser } from "../auth/current-user";
import {
  MODEL_CALL_CEILING_MESSAGE,
  MODEL_CALL_LIMIT_STATUS,
  spendModelCall,
} from "../model-calls/budget";
import { describeIssues } from "../zod-issues";
import { ProfileSkills, type ProfileOrNone, type UploadedCv } from "./contract";
import { readCvWithGemini, type CvReading, type ReadCv } from "./reader";
import { replaceProfileCv, setProfileSkills } from "./repository";
import { tidySkills } from "./skills";
import { supabaseCvStore, type CvStore } from "./storage";
import { cvFrom } from "./upload";
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
    const arrived = await cvFrom(request);
    if ("refusal" in arrived) return arrived.refusal;

    const { bytes, mediaType, fileName } = arrived.cv;

    // The month's AI Usage, asked before the reading starts and never again: a
    // document cannot be priced until it has been read, so a reading admitted
    // here is allowed to finish and overshoot (ADR-0009).
    if ((await mayStartAiCall(user.id)) === "over-limit") {
      return errorResponse(AI_USAGE_SPENT_MESSAGE, AI_USAGE_LIMIT_STATUS);
    }

    // Spent from the one daily count every model call comes out of, and spent
    // before the reading rather than after, so a reading that reached a
    // provider counts whether or not it came back with anything. It is one
    // call per upload: what a PDF costs the model is what the allowance is
    // for, and a text file is not cheap enough to be worth a second rule.
    if ((await spendModelCall(user.id)) === "over-limit") {
      return errorResponse(MODEL_CALL_CEILING_MESSAGE, MODEL_CALL_LIMIT_STATUS);
    }

    let call: Metered<CvReading>;
    try {
      call = await read({ bytes, mediaType });
    } catch (error) {
      // A provider that answered with something unreadable was paid for
      // answering; `tokensSpentBy` is nought for every other way of failing
      // (ADR-0009).
      await recordAiUsage(user.id, tokensSpentBy(error));

      // Every way of failing to reach or understand the provider — an outage,
      // an exhausted quota, a malformed reply — is the same answer here, and a
      // different one from a file that simply had no text in it: this one is
      // not the user's fault and their file is fine.
      return errorResponse(
        "The service that reads CVs could not be reached. Try again shortly.",
        502,
      );
    }

    // What the reading cost. A reading that never reached the provider records
    // nothing and has still spent its Model Call, which is why that one is
    // charged before the provider is reached (ADR-0009).
    await recordAiUsage(user.id, call.tokens);

    const reading = call.answer;
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
      fileName,
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
