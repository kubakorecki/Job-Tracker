import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { tailoredCvs, type TailoredCvRow } from "../db/schema";

/**
 * Every read and write of a Tailored CV. As everywhere else, nothing outside
 * this module builds a query and every function takes the owner's id as its
 * first argument, so tenant isolation stays reviewable (ADR-0001) — here the
 * key is the Job Application, so the owner is named alongside it rather than
 * being inherited from the row the key points at.
 */

/** What an upload has decided by the time it reaches the database. */
export type StoredTailoredCv = {
  storagePath: string;
  fileName: string;
  mediaType: string;
  extractedText: string;
};

/**
 * The Tailored CV attached to one Job Application, or `null` where none is.
 * Absence is the ordinary state: most Job Applications are answered with the
 * Profile, and only the ones the user tailored for carry a document of their
 * own.
 */
export async function getTailoredCv(
  userId: string,
  jobApplicationId: string,
): Promise<TailoredCvRow | null> {
  const rows = await db()
    .select()
    .from(tailoredCvs)
    .where(
      and(
        eq(tailoredCvs.userId, userId),
        eq(tailoredCvs.jobApplicationId, jobApplicationId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Attaches the CV just stored to this Job Application, and answers with the new
 * row alongside the path of the file it replaced — `null` when there was none.
 * The caller takes that old file away afterwards, so an upload that failed
 * between the two leaves an unreferenced object in the bucket rather than a row
 * pointing at a document that is no longer there.
 *
 * One upsert rather than a read and a branch, as the Profile's own replacement
 * is: there is exactly one Tailored CV per Job Application and the key is what
 * says so, so two uploads racing each other cannot make a second one.
 */
export async function replaceTailoredCv(
  userId: string,
  jobApplicationId: string,
  cv: StoredTailoredCv,
): Promise<{ tailoredCv: TailoredCvRow; replaced: string | null }> {
  const previous = await getTailoredCv(userId, jobApplicationId);

  // Both stamps are written by hand, for the reason `replaceProfileCv` writes
  // its own: `$onUpdate` fires for an `update` statement and this is an
  // `insert`, so the conflict branch would otherwise leave `updatedAt` at the
  // moment the first CV was attached — and that stamp is what an Analysis
  // measured against this document reads to know it has moved.
  const now = new Date();
  const stamped = { ...cv, uploadedAt: now, updatedAt: now };

  const [row] = await db()
    .insert(tailoredCvs)
    .values({ userId, jobApplicationId, ...stamped })
    .onConflictDoUpdate({
      target: tailoredCvs.jobApplicationId,
      set: stamped,
      // The key is the Job Application alone, so the conflict branch would
      // otherwise be reachable by anyone who could guess an id. Naming the
      // owner here is what makes a stranger's upload write nothing rather than
      // take the row over (ADR-0001) — the endpoint has already refused them,
      // and this is the write refusing them a second time.
      setWhere: eq(tailoredCvs.userId, userId),
    })
    .returning();

  if (row === undefined) {
    throw new Error("The upsert returned no Tailored CV.");
  }

  return {
    tailoredCv: row,
    // Only a path that is actually being left behind. A replacement writes a
    // new path every time, so the two can only match if nothing moved.
    replaced:
      previous === null || previous.storagePath === row.storagePath
        ? null
        : previous.storagePath,
  };
}

/**
 * Takes the Tailored CV off this Job Application, and answers with the path of
 * the file that is now unreferenced — `null` where there was nothing attached.
 * The caller takes the file away afterwards, in that order for the reason a
 * replacement does it in that order.
 *
 * Detaching is a real act rather than a tidying-up, which is why it exists here
 * and has no counterpart on the Profile: a Job Application with no Tailored CV
 * is one the Profile answers for, and saying "what I am sending is my ordinary
 * CV after all" is something the user is entitled to say.
 */
export async function detachTailoredCv(
  userId: string,
  jobApplicationId: string,
): Promise<string | null> {
  const [row] = await db()
    .delete(tailoredCvs)
    .where(
      and(
        eq(tailoredCvs.userId, userId),
        eq(tailoredCvs.jobApplicationId, jobApplicationId),
      ),
    )
    .returning({ storagePath: tailoredCvs.storagePath });

  return row?.storagePath ?? null;
}
