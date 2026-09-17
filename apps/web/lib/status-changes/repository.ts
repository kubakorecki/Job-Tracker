import type { JobStatus, StatusChange } from "@repo/schema";
import { and, asc, eq } from "drizzle-orm";
import { db, type Queryable } from "../db/client";
import { statusChanges, type StatusChangeRow } from "../db/schema";

/**
 * Every read and write of a Status Change — which, on the writing side, is one
 * statement: a row is appended and nothing ever edits or deletes one
 * (ADR-0010). Like every repository here, each function takes the owner's id
 * as its first argument rather than reading it from a session (ADR-0001).
 *
 * The writes are not called from anywhere but the Job Application repository,
 * and deliberately so: a Status Change is written by the move that causes it,
 * in that move's transaction, so nothing can record a move the row did not
 * make. There is no endpoint that records one on its own, because a client
 * saying "this moved" without moving it would be a client writing history.
 */

/**
 * Appends the Status one Job Application has just come to stand at.
 *
 * Takes a `Queryable` rather than opening its own transaction, because the
 * caller decides what has to succeed together — and here that is everything: a
 * move that was recorded but did not happen, or happened and was not recorded,
 * are both worse than a move that failed outright.
 *
 * It is called at most once per transaction, which is what keeps `changed_at`
 * an order: the stamp is the transaction's `now()`, so two moves recorded
 * inside one would share it and be indistinguishable — the hazard
 * `appendMessage` avoids the same way. Nothing moves a Status twice in one
 * transaction today, and a caller that wanted to would have to say which came
 * first rather than leave it to the clock.
 */
export async function recordStatusChange(
  queryable: Queryable,
  userId: string,
  jobApplicationId: string,
  status: JobStatus,
): Promise<void> {
  await queryable
    .insert(statusChanges)
    .values({ userId, jobApplicationId, status });
}

/**
 * One Job Application's history, oldest first — the order it happened in,
 * which is the only order it can be read back in.
 *
 * Empty for a Job Application that has not moved since recording began, which
 * is not the same as one that never moved: the months before this shipped have
 * no Status Changes at all, and nothing here pretends otherwise (ADR-0010).
 */
export async function statusChangesFor(
  userId: string,
  jobApplicationId: string,
): Promise<StatusChange[]> {
  const rows = await db()
    .select()
    .from(statusChanges)
    .where(
      and(
        eq(statusChanges.userId, userId),
        eq(statusChanges.jobApplicationId, jobApplicationId),
      ),
    )
    .orderBy(asc(statusChanges.changedAt));

  return rows.map(toStatusChange);
}

/** A row as the shared contract describes it: the stamp as an ISO string. */
function toStatusChange(row: StatusChangeRow): StatusChange {
  return {
    id: row.id,
    jobApplicationId: row.jobApplicationId,
    status: row.status,
    changedAt: row.changedAt.toISOString(),
  };
}
