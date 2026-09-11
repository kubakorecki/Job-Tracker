import { z } from "zod";
import { CvMediaType } from "../profile/contract";

/**
 * What a Tailored CV looks like to a client: the one CV attached to one Job
 * Application — the document the user is actually sending for this job. While
 * none is attached, the Profile stands in as what would be sent, which is why
 * absence here is an ordinary answer rather than a failure.
 *
 * It lives beside the feature rather than in `@repo/schema` for the Profile's
 * reason: the extension has no CV to attach and nothing to show one in, and the
 * dashboard is the only surface that attaches or reads one.
 *
 * What a CV may be — the three formats, the size limit, the field an upload
 * arrives in — is not restated here. It is one rule for both CVs and it lives
 * in `../profile/contract`, where the first CV in the product put it; the same
 * goes for the store in `../profile/storage` and the reader in
 * `../profile/reader`. Those three are the CV machinery rather than the
 * Profile's own, and the day a third caller wants them is the day they move to
 * a `lib/cvs` of their own — one caller more does not earn the churn.
 *
 * There is deliberately no storage path in this shape, and no skill list. Where
 * the file sits in a private bucket is the store's business, and a skill list is
 * the user's own side of the comparison: there is exactly one, on the Profile,
 * and a document sent for one job says nothing about it.
 */
export const TailoredCv = z.object({
  /** The name the file was uploaded under, kept so a download can offer it back. */
  fileName: z.string().min(1),
  mediaType: CvMediaType,
  /** The document's text, as read from the file. What an Analysis reads. */
  extractedText: z.string(),
  /** A short-lived signed URL, for viewing the file and for downloading it. */
  fileUrl: z.url(),
  /** When the file that is attached now was uploaded. */
  uploadedAt: z.iso.datetime(),
});
export type TailoredCv = z.infer<typeof TailoredCv>;

/**
 * What reading one answers with. `null` is a first-class answer rather than a
 * 404: most Job Applications have no Tailored CV, and the Profile standing in
 * for one is the ordinary state of the product — an endpoint that called it an
 * error would make every client handle the common case in a catch block.
 */
export const TailoredCvOrNone = TailoredCv.nullable();
export type TailoredCvOrNone = z.infer<typeof TailoredCvOrNone>;
