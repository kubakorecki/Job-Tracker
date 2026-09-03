import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { extractionUsage } from "../db/schema";

/**
 * The daily extraction counter. Like every other repository module here, each
 * function takes the owner's id as its first argument and nothing else in the
 * app builds a query (ADR-0001).
 */

/**
 * The day a counter is keyed on: UTC, so a counter cannot reset twice for a
 * user who changed time zone, or fail to reset at all.
 */
export function extractionDay(at: Date = new Date()): string {
  return at.toISOString().slice(0, 10);
}

/**
 * Spends one extraction and answers how many this user has now spent today.
 *
 * Insert and increment are one statement, so two requests arriving together
 * cannot both read a count and both write the same successor. It is also why
 * the caller learns the new total from the write itself rather than reading
 * first and deciding second — a check-then-act would let a leaked token spend
 * as fast as it could open connections.
 */
export async function spendExtraction(
  userId: string,
  day: string = extractionDay(),
): Promise<number> {
  const [row] = await db()
    .insert(extractionUsage)
    .values({ userId, day, count: 1 })
    .onConflictDoUpdate({
      target: [extractionUsage.userId, extractionUsage.day],
      set: { count: sql`${extractionUsage.count} + 1` },
    })
    .returning({ count: extractionUsage.count });

  if (row === undefined) {
    throw new Error("The upsert returned no extraction counter.");
  }

  return row.count;
}

/**
 * Sets a day's counter outright. Nothing a user does reaches this: it exists
 * so a test can stand at the edge of the daily limit without spending a
 * hundred round trips to walk there, which is the only way the limit itself
 * stays the number the product ships.
 */
export async function setExtractionCount(
  userId: string,
  count: number,
  day: string = extractionDay(),
): Promise<void> {
  await db()
    .insert(extractionUsage)
    .values({ userId, day, count })
    .onConflictDoUpdate({
      target: [extractionUsage.userId, extractionUsage.day],
      set: { count },
    });
}

/**
 * Forgets a day's counter. Nothing in the product forgets one either — a
 * counter is meant to stand until the day turns — so this too is here for the
 * test that has to take its own rows away again.
 */
export async function forgetExtractionUsage(
  userId: string,
  day: string = extractionDay(),
): Promise<void> {
  await db()
    .delete(extractionUsage)
    .where(
      and(eq(extractionUsage.userId, userId), eq(extractionUsage.day, day)),
    );
}
