import { eq } from "drizzle-orm";
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
 * Forgets a user's Profile. Nothing in the product deletes one — a CV is
 * replaced, never removed — so this is here for the test that has to take its
 * own row away again.
 */
export async function forgetProfile(userId: string): Promise<void> {
  await db().delete(profiles).where(eq(profiles.userId, userId));
}
