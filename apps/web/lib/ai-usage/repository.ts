import { and, eq, sql } from "drizzle-orm";
import { aiUsage } from "../db/schema";
import { db } from "../db/client";

/**
 * The monthly token meter. Like every other repository module here, each
 * function takes the owner's id as its first argument and nothing else in the
 * app builds a query (ADR-0001).
 */

/**
 * The month a meter is keyed on, as the UTC day it starts on: UTC for the
 * reason the daily counter is — a meter that reset at the reader's midnight
 * would reset twice for a user who changed time zone, or not at all.
 */
export function aiUsageMonth(at: Date = new Date()): string {
  return `${at.toISOString().slice(0, 7)}-01`;
}

/**
 * Records what one call spent and answers with what this user has now spent
 * this month.
 *
 * Called once a call has finished and the provider has said what it cost, so a
 * call that failed before an answer arrived records nothing — it has still
 * spent its Model Call, which is charged before the provider is reached and is
 * deliberately the other limit's business (ADR-0009). A call that reported
 * nothing is recorded as nothing rather than skipped, so the month's row
 * exists from the first call either way.
 *
 * Insert and add are one statement, so two calls finishing together cannot
 * both read a total and both write the same successor — the same argument
 * `countModelCall` makes, and the reason the caller learns the new total from
 * the write rather than reading first and deciding second.
 */
export async function recordAiUsage(
  userId: string,
  tokens: number,
  month: string = aiUsageMonth(),
): Promise<number> {
  const [row] = await db()
    .insert(aiUsage)
    .values({ userId, month, tokens })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.month],
      set: { tokens: sql`${aiUsage.tokens} + ${tokens}` },
    })
    .returning({ tokens: aiUsage.tokens });

  if (row === undefined) {
    throw new Error("The upsert returned no AI Usage meter.");
  }

  return row.tokens;
}

/**
 * What this user has spent this month, in tokens. Zero where they have spent
 * nothing, which is the ordinary state at the start of a month rather than an
 * absence worth distinguishing.
 */
export async function aiUsageSoFar(
  userId: string,
  month: string = aiUsageMonth(),
): Promise<number> {
  const rows = await db()
    .select({ tokens: aiUsage.tokens })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), eq(aiUsage.month, month)))
    .limit(1);

  return rows[0]?.tokens ?? 0;
}

/**
 * Sets a month's meter outright. Nothing a user does reaches this: it exists
 * so a test can stand at the edge of the monthly limit without spending
 * millions of tokens to walk there, which is the only way the limit itself
 * stays the number the product ships — the same reason `setModelCallCount`
 * exists beside it.
 */
export async function setAiUsage(
  userId: string,
  tokens: number,
  month: string = aiUsageMonth(),
): Promise<void> {
  await db()
    .insert(aiUsage)
    .values({ userId, month, tokens })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.month],
      set: { tokens },
    });
}

/**
 * Forgets a month's meter. Nothing in the product forgets one either — a meter
 * is meant to stand until the month turns — so this too is here for the test
 * that has to take its own rows away again.
 */
export async function forgetAiUsage(
  userId: string,
  month: string = aiUsageMonth(),
): Promise<void> {
  await db()
    .delete(aiUsage)
    .where(and(eq(aiUsage.userId, userId), eq(aiUsage.month, month)));
}
