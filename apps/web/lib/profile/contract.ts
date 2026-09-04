import { z } from "zod";

/**
 * What a Profile looks like to a client. It lives here rather than in
 * `@repo/schema` because it is not a shared contract: the extension has no CV
 * to upload and nothing to show one in, and the dashboard is the only surface
 * that reads or replaces the file.
 *
 * There is deliberately no storage path in this shape. Where the file sits in
 * the bucket is the store's business, and a private bucket's path is of no use
 * to a client — the signed URL is what it gets to hold instead.
 */

/**
 * What a CV may be uploaded as. PDF because that is what most people export;
 * Markdown and plain text because a CV kept as text should not have to go
 * through a PDF export first. DOCX is deliberately absent: everything storable
 * should also be readable, and DOCX is not readable without a parser.
 *
 * These are the IANA identifiers rather than a domain vocabulary of our own,
 * which is why the column that stores one is text: the endpoint decides what
 * is accepted, and it decides it before anything is written.
 */
export const CvMediaType = z.enum([
  "application/pdf",
  "text/markdown",
  "text/plain",
]);
export type CvMediaType = z.infer<typeof CvMediaType>;

/** What the refusal names, in the words a person uses for these three. */
export const ACCEPTED_CV_FORMATS =
  "a PDF, a Markdown file or a plain text file";

/**
 * The user's master CV. One per user — there is exactly one, so it has no id
 * of its own and is addressed as the Profile of whoever is asking.
 *
 * `fileUrl` is minted per read and expires (`CV_URL_TTL_SECONDS`), so a client
 * holding an old Profile holds an old link: the bucket is private, and a URL
 * that never expired would be a public one with extra steps.
 */
export const Profile = z.object({
  /** The name the file was uploaded under, kept so a download can offer it back. */
  fileName: z.string().min(1),
  mediaType: CvMediaType,
  /** The document's text, as read from the file. What an Analysis reads. */
  extractedText: z.string(),
  /** A short-lived signed URL, for viewing the file and for downloading it. */
  fileUrl: z.url(),
  /** When the file that is there now was uploaded. */
  uploadedAt: z.iso.datetime(),
});
export type Profile = z.infer<typeof Profile>;

/**
 * What reading the Profile answers with. `null` is a first-class answer rather
 * than a 404: a user who has not uploaded a CV yet is in an ordinary state, and
 * an endpoint that called it an error would make every client handle the
 * ordinary case in a catch block.
 */
export const ProfileOrNone = Profile.nullable();
export type ProfileOrNone = z.infer<typeof ProfileOrNone>;
