import type { ProfileRow } from "../db/schema";
import { CvMediaType, type Profile, type ProfileOrNone } from "./contract";
import { getProfile } from "./repository";
import { supabaseCvStore, type CvStore } from "./storage";

/**
 * A Profile as anything outside this feature sees one: a stored row and a
 * short-lived link to the document it names, put together.
 *
 * It sits apart from `./api` because two callers need it and only one of them
 * is an endpoint. The Profile page renders on the server, where an HTTP hop to
 * this app's own `GET /api/profile` would buy nothing — the same arrangement
 * the dashboard makes with `listJobApplications`, except that a Profile is
 * half a database row and half a signed URL, so reading one is more than a
 * query.
 *
 * The store is substitutable for the endpoint's tests, which have no bucket.
 * `readProfile` defaults it because the page calls that one with a user and
 * nothing else; `profileFrom` has no default, because both its callers already
 * hold a store and a default nobody reaches is a seam that cannot be trusted.
 */

/**
 * One user's Profile, or `null` when they have not uploaded a CV. Absence is
 * an ordinary state — most users are in it until their first upload — and the
 * page reads it as a first run rather than as a failure.
 */
export async function readProfile(
  userId: string,
  store: CvStore = supabaseCvStore,
): Promise<ProfileOrNone> {
  const row = await getProfile(userId);

  return row === null ? null : profileFrom(row, store);
}

/**
 * A row as the contract describes it: no storage path, because where the file
 * sits in a private bucket is of no use to a client, and a signed URL in its
 * place.
 *
 * The URL is minted here, per read, and expires (`CV_URL_TTL_SECONDS`) — which
 * is what lets the bucket stay private, and why a page left open long enough
 * has to ask for the Profile again before the document will open.
 */
export async function profileFrom(
  row: ProfileRow,
  store: CvStore,
): Promise<Profile> {
  return {
    fileName: row.fileName,
    // The column is text, because media types are somebody else's vocabulary;
    // the parse is what keeps the response's promise about which three it is.
    mediaType: CvMediaType.parse(row.mediaType),
    extractedText: row.extractedText,
    skills: row.skills,
    fileUrl: await store.signedUrl(row.userId, row.storagePath),
    uploadedAt: row.uploadedAt.toISOString(),
  };
}
