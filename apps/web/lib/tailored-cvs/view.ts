import type { TailoredCvRow } from "../db/schema";
import { CvMediaType } from "../profile/contract";
import { supabaseCvStore, type CvStore } from "../profile/storage";
import type { TailoredCv, TailoredCvOrNone } from "./contract";
import { getTailoredCv } from "./repository";

/**
 * A Tailored CV as anything outside this feature sees one: a stored row and a
 * short-lived link to the document it names, put together.
 *
 * It sits apart from `./api` because two callers need it and only one of them
 * is an endpoint — the Job Application page renders on the server, where an
 * HTTP hop to this app's own API would buy nothing. The same arrangement the
 * Profile's own view module makes, for the same reason.
 */

/**
 * The Tailored CV attached to one Job Application, or `null` where none is —
 * which is the state the page reads as "the Profile is what you would send".
 */
export async function readTailoredCv(
  userId: string,
  jobApplicationId: string,
  store: CvStore = supabaseCvStore,
): Promise<TailoredCvOrNone> {
  const row = await getTailoredCv(userId, jobApplicationId);

  return row === null ? null : tailoredCvFrom(row, store);
}

/**
 * A row as the contract describes it: no storage path, and a signed URL in its
 * place. The URL is minted here, per read, and expires (`CV_URL_TTL_SECONDS`) —
 * which is what lets the bucket stay private, and why a page left open long
 * enough has to ask again before the document will open.
 */
export async function tailoredCvFrom(
  row: TailoredCvRow,
  store: CvStore,
): Promise<TailoredCv> {
  return {
    fileName: row.fileName,
    // The column is text, because media types are somebody else's vocabulary;
    // the parse is what keeps the response's promise about which three it is.
    mediaType: CvMediaType.parse(row.mediaType),
    extractedText: row.extractedText,
    fileUrl: await store.signedUrl(row.userId, row.storagePath),
    uploadedAt: row.uploadedAt.toISOString(),
  };
}
