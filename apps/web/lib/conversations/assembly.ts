import type { JobApplication } from "@repo/schema";
import { todayInUtc } from "../day";
import { listJobApplications } from "../job-applications/repository";
import { getAnalysis } from "../analysis/repository";
import { getProfile } from "../profile/repository";
import { getTailoredCv } from "../tailored-cvs/repository";
import { attachedPrompt, generalPrompt, type ProfileContext } from "./context";

/**
 * The rows one turn is assembled from, read and handed to the pure assemblers
 * in `./context`.
 *
 * It is the half of assembly that touches the database, kept apart from the
 * half that decides what the model is told: `context.ts` is a pure function of
 * rows and stays testable with nothing behind it, and this is the only place
 * that goes and gets them. Each function takes the owner's id first and reads
 * through the repositories, so the scoping is the one ADR-0001 put there.
 *
 * Both are seams the endpoints take as arguments. A test that wants to prove
 * what the model was shown substitutes one of these and keeps what it was
 * handed — the prompt's own wording is `context.test.ts`'s business, and
 * asserting it again through an endpoint would be two places to change when a
 * sentence moves.
 */

/** The instructions one turn of an attached Conversation is sent with. */
export type AssembleAttached = (
  userId: string,
  jobApplication: JobApplication,
) => Promise<string>;

/** The instructions one turn of the general Conversation is sent with. */
export type AssembleGeneral = (userId: string) => Promise<string>;

/** The two, as an endpoint is handed them. */
export type Assemblers = {
  attached: AssembleAttached;
  general: AssembleGeneral;
};

/**
 * A Job Application in full, its Analysis where one has run, the name of any
 * Tailored CV, and the Profile.
 *
 * The Job Application arrives already read, because the endpoint read it to
 * find out whether this scope is the user's at all — and reading it twice
 * would be a second query to reach a row already in hand.
 */
export const assembleAttached: AssembleAttached = async (
  userId,
  jobApplication,
) => {
  const [profile, analysis, tailoredCv] = await Promise.all([
    profileContext(userId),
    getAnalysis(userId, jobApplication.id),
    getTailoredCv(userId, jobApplication.id),
  ]);

  return attachedPrompt({
    jobApplication,
    analysis:
      analysis === null
        ? null
        : { rating: analysis.rating, feedback: analysis.feedback },
    // The name and nothing else. What the document says is deliberately not
    // readable from here: the Profile is already in the prompt, and the two
    // answer different questions (ADR-0004, ADR-0008).
    tailoredCv: tailoredCv === null ? null : { fileName: tailoredCv.fileName },
    profile,
    today: todayInUtc(),
  });
};

/** Every Job Application in one-line outline, and the Profile. */
export const assembleGeneral: AssembleGeneral = async (userId) => {
  const [profile, jobApplications] = await Promise.all([
    profileContext(userId),
    listJobApplications(userId),
  ]);

  // Every one of them, with no narrowing by Status: "which of these should I
  // chase this week?" is answered across the whole pipeline, and a rejection
  // is part of the shape of a search rather than a row to hide.
  return generalPrompt({ jobApplications, profile, today: todayInUtc() });
};

/** The two assemblers as the endpoints use them when nothing stands in. */
export const ASSEMBLERS: Assemblers = {
  attached: assembleAttached,
  general: assembleGeneral,
};

/**
 * The user's own side of the comparison, or `null` where they have uploaded no
 * CV — which is an ordinary state rather than a failure, and one the prompt
 * says out loud so that advice never leans on experience nobody has read (the
 * spec's stories 19 and 20).
 */
async function profileContext(userId: string): Promise<ProfileContext | null> {
  const profile = await getProfile(userId);
  if (profile === null) return null;

  return { cvText: profile.extractedText, skills: profile.skills };
}
