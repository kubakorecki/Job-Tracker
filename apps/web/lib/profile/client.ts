import { send, upload } from "../api/client";
import {
  CV_FIELD,
  type Profile,
  type ProfileOrNone,
  type ProfileSkills,
  type UploadedCv,
} from "./contract";

/**
 * The Profile endpoints, as the Profile page addresses them.
 *
 * There is no accept here and no discard, for the same reason there is neither
 * on the server: accepting a Draft is saying what the list should be, which is
 * what `putProfileSkills` does; discarding is the page letting go of a
 * proposal nothing ever stored.
 */

const ENDPOINT = "/api/profile";

/**
 * Replaces the user's CV with this file, and answers with the Profile as it
 * now stands beside the skill list the reading proposed.
 *
 * The proposal is a Draft: it is not the Profile's until it is sent back
 * through `putProfileSkills`, so a caller that drops it has discarded it and
 * changed nothing.
 *
 * This is the one request in the app that waits on a model call, and the page
 * is expected to say so while it is in flight.
 */
export async function uploadCv(file: File): Promise<UploadedCv> {
  const body = new FormData();
  body.set(CV_FIELD, file);

  return upload(ENDPOINT, body);
}

/**
 * The Profile, or `null` for a user who has not uploaded a CV — an ordinary
 * answer rather than a failure.
 *
 * `fetch` rather than `get`, as the other client modules name theirs: the
 * repository has a `getProfile` of its own, and the two answer to different
 * halves of the app.
 *
 * Read again for a fresh link: the URL a Profile carries is signed and
 * short-lived, so a page open longer than that has to ask for another before
 * the document will open.
 */
export async function fetchProfile(): Promise<ProfileOrNone> {
  return send(ENDPOINT);
}

/**
 * Makes the skill list what the user says it is, and answers with what it now
 * is. The same request whether they are accepting a Draft the model proposed a
 * moment ago or correcting a list they accepted months back.
 */
export async function putProfileSkills(
  skills: string[],
): Promise<ProfileSkills> {
  return send(`${ENDPOINT}/skills`, { method: "PUT", body: { skills } });
}

/**
 * The same link, asking for a save rather than a view. The store deliberately
 * signs one URL for both — a signed URL that always downloaded could not also
 * be the one the page shows the document in — and this is the client saying
 * which of the two it wants, exactly as `storage.ts` says it should.
 *
 * `download` is a plain query parameter Storage reads off the request; it is
 * not part of what was signed, so appending it here needs no second signature
 * and costs no second round trip. An `<a download>` cannot do this job: the
 * bucket is on another origin, and the attribute is ignored across origins.
 */
export function downloadUrlFor({ fileUrl, fileName }: Profile): string {
  // Parsed rather than concatenated. Whether a signed URL already carries a
  // query string is the store's business and could change; whether this is the
  // right way to add a parameter to one cannot.
  const asking = new URL(fileUrl);
  asking.searchParams.set("download", fileName);

  return asking.toString();
}
