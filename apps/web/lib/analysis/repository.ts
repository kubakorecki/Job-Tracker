import { and, eq, sql } from "drizzle-orm";
import {
  recordAnalysedCoverage,
  PROFILE,
  type AnalysedRequirement,
} from "../coverage/repository";
import { db } from "../db/client";
import { analyses, type AnalysisRow } from "../db/schema";

/**
 * Every read and write of an Analysis: the stamp that says the model has read
 * one Job Application against one Basis, and when.
 *
 * Like every other repository module here, each function takes the owner's id
 * as its first argument and nothing else in the app builds a query, so tenant
 * isolation stays reviewable (ADR-0001).
 *
 * The verdicts are not this module's — they live on the Requirements they are
 * about, written by `coverage/repository`, which owns those columns. What is
 * here is the half of a run that belongs to no single Requirement, which is
 * the half staleness is derived from.
 */

/**
 * The Analysis of one Job Application, or `null` where none has run — which is
 * the same answer for a Job Application belonging to somebody else, so that a
 * caller cannot tell a stranger's row from an unanalysed one.
 *
 * Only the Profile's reading is ever asked for today; the Tailored CV effort
 * adds its own row here rather than moving this one (ADR-0004).
 */
export async function getAnalysis(
  userId: string,
  jobApplicationId: string,
): Promise<AnalysisRow | null> {
  const rows = await db()
    .select()
    .from(analyses)
    .where(
      and(
        eq(analyses.userId, userId),
        eq(analyses.jobApplicationId, jobApplicationId),
        eq(analyses.basis, PROFILE),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Writes what a run read and stamps that it happened.
 *
 * Both in one transaction, because they are one fact: verdicts with no stamp
 * would be an Analysis whose age nothing could tell, and a stamp with no
 * verdicts would claim a reading that is not there. It is also what makes a
 * failed write leave the previous Analysis exactly as it was.
 *
 * The stamp is the database's own `now()` rather than this process's clock,
 * because it is only ever read against other stored stamps — a Requirement's
 * `created_at`, which Postgres writes — and two clocks deciding whether an
 * Analysis is stale would make the answer depend on which machine ran it.
 *
 * The stamp is replaced rather than added to — one Analysis per Job
 * Application per Basis — because only the current reading is ever shown, and
 * a history of runs is a feature nothing has asked for. A re-run therefore
 * un-stales itself by moving the stamp past whatever had moved under it.
 */
export async function recordAnalysis(
  userId: string,
  jobApplicationId: string,
  readings: readonly AnalysedRequirement[],
): Promise<void> {
  await db().transaction(async (tx) => {
    await recordAnalysedCoverage(tx, userId, jobApplicationId, readings);

    await tx
      .insert(analyses)
      .values({ userId, jobApplicationId, basis: PROFILE })
      .onConflictDoUpdate({
        target: [analyses.jobApplicationId, analyses.basis],
        // Written out rather than left to the column default, because the
        // conflict branch of an upsert takes no default at all — a re-run
        // would otherwise keep the first run's stamp and read as stale for as
        // long as the Job Application lived.
        set: { ranAt: sql`now()` },
        // Scoped by owner like every other statement here. The id came from a
        // scoped read, but a statement that names the owner itself is what
        // makes that reviewable (ADR-0001).
        setWhere: eq(analyses.userId, userId),
      });
  });
}
