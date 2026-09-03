import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../db/client";
import {
  personalAccessTokens,
  type PersonalAccessTokenRow,
} from "../db/schema";
import type { PersonalAccessToken } from "./contract";

/**
 * Every read and write of a Personal Access Token. As with Job Applications,
 * nothing else in the app builds a query and every function takes the owner's
 * id as its first argument, so tenant isolation stays reviewable (ADR-0001).
 *
 * `authenticatePersonalAccessToken` is the one exception, and it has to be:
 * it is the query that *establishes* who the owner is, and a request carrying
 * a token has said nothing else about itself.
 */

export async function createPersonalAccessToken(
  userId: string,
  token: { name: string; tokenHash: string },
): Promise<PersonalAccessToken> {
  const [row] = await db()
    .insert(personalAccessTokens)
    .values({ ...token, userId })
    .returning();

  if (row === undefined) {
    throw new Error("The insert returned no Personal Access Token.");
  }

  return toPersonalAccessToken(row);
}

/** This user's tokens, newest first — revoked ones included, as their trace. */
export async function listPersonalAccessTokens(
  userId: string,
): Promise<PersonalAccessToken[]> {
  const rows = await db()
    .select()
    .from(personalAccessTokens)
    .where(eq(personalAccessTokens.userId, userId))
    .orderBy(desc(personalAccessTokens.createdAt));

  return rows.map(toPersonalAccessToken);
}

/**
 * Stops a token working, keeping the row. Returns `null` when this user has no
 * unrevoked token by that id — the same answer for one that does not exist,
 * one belonging to somebody else, and one revoked already, so revoking twice
 * cannot report success and no caller learns a stranger's token is real.
 */
export async function revokePersonalAccessToken(
  userId: string,
  id: string,
): Promise<PersonalAccessToken | null> {
  const [row] = await db()
    .update(personalAccessTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(personalAccessTokens.userId, userId),
        eq(personalAccessTokens.id, id),
        isNull(personalAccessTokens.revokedAt),
      ),
    )
    .returning();

  return row === undefined ? null : toPersonalAccessToken(row);
}

/**
 * Who a token belongs to, and `null` for one that was never issued or has been
 * revoked — a revoked token stops working on the very next request, because
 * this is the only question ever asked of it.
 *
 * The last-used stamp is part of the same statement rather than a read
 * followed by a write: it makes authentication one round trip, and there is no
 * window in which a token could be revoked between the two halves.
 */
export async function authenticatePersonalAccessToken(
  tokenHash: string,
): Promise<string | null> {
  const [row] = await db()
    .update(personalAccessTokens)
    .set({ lastUsedAt: new Date() })
    .where(
      and(
        eq(personalAccessTokens.tokenHash, tokenHash),
        isNull(personalAccessTokens.revokedAt),
      ),
    )
    .returning({ userId: personalAccessTokens.userId });

  return row?.userId ?? null;
}

/**
 * Removes a token outright, leaving no trace. Revocation is what a user does;
 * this exists because a test must take its own rows away again, and a soft
 * revocation would leave them behind for good.
 */
export async function deletePersonalAccessToken(
  userId: string,
  id: string,
): Promise<boolean> {
  const deleted = await db()
    .delete(personalAccessTokens)
    .where(
      and(
        eq(personalAccessTokens.userId, userId),
        eq(personalAccessTokens.id, id),
      ),
    )
    .returning({ id: personalAccessTokens.id });

  return deleted.length > 0;
}

/**
 * A row as a client sees it: timestamps as ISO strings, and no hash. Mapped
 * field by field rather than spread, so the stored credential cannot reach a
 * response by being added to the table later.
 */
function toPersonalAccessToken(
  row: PersonalAccessTokenRow,
): PersonalAccessToken {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}
