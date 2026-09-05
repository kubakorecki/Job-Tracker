import { eq } from "drizzle-orm";
import { recordNormalisedCoverage } from "../coverage/repository";
import { db } from "../db/client";
import { profiles, type ProfileRow } from "../db/schema";

/**
 * Every read and write of a Profile. As with Job Applications, nothing else in
 * the app builds a query and every function takes the owner's id as its first
 * argument, so tenant isolation stays reviewable (ADR-0001) — here the id is
 * also the key, so a query that named no owner would have nothing to address.
 */

/** What an upload has decided by the time it reaches the database. */
export type StoredCv = {
  storagePath: string;
  fileName: string;
  mediaType: string;
  extractedText: string;
};

/**
 * One user's Profile, or `null` when they have not uploaded a CV. Absence is
 * an ordinary state — most users are in it until their first upload — not a
 * missing record.
 */
export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const rows = await db()
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Just the skill list this user has accepted — empty for a user who has no
 * Profile at all, which is the same answer as a Profile whose list they have
 * not accepted yet.
 *
 * The two are deliberately one answer: the comparison has nothing to measure a
 * Requirement against either way, and `normalisedReadingOf` is where that
 * turns into "nothing has been read" rather than "you have none of this".
 *
 * A read of its own rather than `getProfile`, because it runs on every write
 * of a Job Application's Requirements and a Profile carries a whole CV's text.
 */
export async function acceptedSkills(userId: string): Promise<string[]> {
  const rows = await db()
    .select({ skills: profiles.skills })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  return rows[0]?.skills ?? [];
}

/**
 * Makes this user's Profile point at the CV just stored, and answers with the
 * new row alongside the path of the file it replaced — `null` when there was
 * none. The caller takes that old file away afterwards, so an upload that
 * failed between the two leaves an unreferenced object in the bucket rather
 * than a Profile pointing at a document that is no longer there.
 *
 * One upsert rather than a read and a branch: there is exactly one Profile per
 * user, and the key is what says so, so two uploads racing each other cannot
 * make a second one.
 *
 * The skill list is deliberately not touched. It belongs to the user from the
 * moment they accept it, and replacing the document is not a decision about
 * it.
 */
export async function replaceProfileCv(
  userId: string,
  cv: StoredCv,
): Promise<{ profile: ProfileRow; replaced: string | null }> {
  const previous = await getProfile(userId);

  // Both stamps are written by hand. `$onUpdate` fires for an `update`
  // statement and this is an `insert`, so an upsert that took the conflict
  // branch would otherwise leave `updatedAt` at the moment the first CV was
  // uploaded — and that stamp is what an Analysis reads to know whether what
  // it was measured against has moved.
  const now = new Date();
  const stamped = { ...cv, uploadedAt: now, updatedAt: now };

  const [row] = await db()
    .insert(profiles)
    .values({ userId, ...stamped })
    .onConflictDoUpdate({ target: profiles.userId, set: stamped })
    .returning();

  if (row === undefined) {
    throw new Error("The upsert returned no Profile.");
  }

  return {
    profile: row,
    // Only a path that is actually being left behind. A replacement writes a
    // new path every time, so the two can only match if nothing moved.
    replaced:
      previous === null || previous.storagePath === row.storagePath
        ? null
        : previous.storagePath,
  };
}

/**
 * Makes this user's skill list what they say it is, and answers with the
 * Profile as it now stands — `null` when they have no Profile to set one on.
 * Accepting a Draft and editing the list a week later are the same write:
 * either way the user has said what the list should be.
 *
 * Nothing about the document is touched. The file, its name and its text are
 * the Profile's other half, with a different owner (the document is replaced,
 * never edited), and an edit to a skill list is not a claim about either.
 *
 * `updatedAt` moves, though `uploadedAt` does not: the stamp `$onUpdate` keeps
 * is what an Analysis reads to know that what it was measured against has
 * changed, and an edited skill list has changed it as surely as a new
 * document would.
 */
export async function setProfileSkills(
  userId: string,
  skills: string[],
): Promise<ProfileRow | null> {
  return db().transaction(async (tx) => {
    const [row] = await tx
      .update(profiles)
      .set({ skills })
      .where(eq(profiles.userId, userId))
      .returning();

    if (row === undefined) return null;

    // The user's own side of the comparison just moved, so every Requirement
    // they own reads differently now. In the same transaction as the write
    // above, because a reading that survived a failed skill change would be
    // describing a list nobody has.
    await recordNormalisedCoverage(tx, userId, row.skills);

    return row;
  });
}

/**
 * Forgets a user's Profile. Nothing in the product deletes one — a CV is
 * replaced, never removed — so this is here for the test that has to take its
 * own row away again.
 */
export async function forgetProfile(userId: string): Promise<void> {
  await db().delete(profiles).where(eq(profiles.userId, userId));
}
