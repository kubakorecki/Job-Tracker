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
 * What a file picker should offer, so that the dialogue shows the three
 * formats rather than everything on the disk. Extensions as well as media
 * types, because a `.md` file is `text/markdown`, `text/plain` or nothing at
 * all depending on the operating system — the same disagreement the endpoint
 * settles when the file arrives.
 *
 * It is a hint and never a check: an `accept` attribute can be stepped past in
 * every browser, and what a CV may be is decided by the endpoint.
 */
export const CV_FILE_ACCEPT =
  ".pdf,.md,.markdown,.txt,application/pdf,text/markdown,text/plain";

/**
 * The form field an upload arrives in. Here rather than in either end, so that
 * the page that sends a CV and the endpoint that reads one name it once.
 */
export const CV_FIELD = "file";

/**
 * The largest CV this will take. A CV is a few pages; anything past this is a
 * mistake or an attack, and refusing it costs the user a message rather than a
 * model call. It also sits under the 4.5MB a serverless request body may be on
 * the deployment, so the refusal is ours and legible rather than the
 * platform's — which is why the page checks it too, before spending a minute
 * of someone's connection on a body that cannot arrive.
 */
export const MAX_CV_BYTES = 4 * 1024 * 1024;

/** The same size in the units a person reads it in. */
export const MAX_CV_MEGABYTES = MAX_CV_BYTES / (1024 * 1024);

/**
 * What too large a CV is told, worded once. The endpoint refuses one and so
 * does the page, and a user who saw two different sentences for one rule would
 * reasonably wonder which of the two they had broken.
 */
export const CV_TOO_LARGE = `A CV has to be under ${MAX_CV_MEGABYTES}MB.`;

/**
 * One skill on a Profile, worded as the user keeps it. There is no vocabulary
 * behind it and no taxonomy to belong to: a skill is whatever the user says
 * they can do, and the comparison that reads it later normalises rather than
 * demanding a canonical name.
 */
export const Skill = z.string().trim().min(1).max(120);
export type Skill = z.infer<typeof Skill>;

/**
 * How many skills a Profile may list. Generous enough that nobody's CV runs
 * out, low enough that the column cannot be used as storage — the model is
 * asked for far fewer, and a list this long is a user who pasted something.
 */
export const SKILL_LIST_LIMIT = 100;

export const SkillList = z.array(Skill).max(SKILL_LIST_LIMIT);
export type SkillList = z.infer<typeof SkillList>;

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
  /**
   * The skill list the user accepted, and has edited since. Empty until they
   * accept one: a Draft the user never answered is not the Profile's, and the
   * file having been read is not the same as the reading having been believed.
   */
  skills: SkillList,
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

/**
 * What an upload answers with: the Profile as it now stands, and the Draft the
 * reading proposed.
 *
 * The two are deliberately side by side rather than merged. The Profile's
 * skills are whatever the user last accepted — a replacement upload does not
 * touch them — and `proposedSkills` is a Draft in the glossary's sense, held
 * by the client while the user corrects it and gone if they never accept it.
 * Nothing persists it, which is what makes discarding cost nothing.
 */
export const UploadedCv = z.object({
  profile: Profile,
  proposedSkills: SkillList,
});
export type UploadedCv = z.infer<typeof UploadedCv>;

/**
 * The skill list, both as it is sent and as it comes back. Accepting a Draft
 * and editing the list later are the same request: the user says what the list
 * should be, and is told what it now is. There is no separate "accept",
 * because the Draft the user is accepting is one they may have rewritten
 * entirely, and a list is a list however it was arrived at.
 */
export const ProfileSkills = z.object({ skills: SkillList });
export type ProfileSkills = z.infer<typeof ProfileSkills>;
