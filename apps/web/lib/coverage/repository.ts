import type { Basis, Coverage } from "@repo/schema";
import { and, eq, inArray } from "drizzle-orm";
import type { Queryable } from "../db/client";
import { requirements } from "../db/schema";
import { normalisedCoverageOf } from "./compare";

/**
 * The Coverage readings on a Requirement row: who may write them, and what the
 * automatic one says.
 *
 * The rows themselves belong to `job-applications/repository` — it is what
 * creates them, orders them and takes them away with their Job Application.
 * What is here is the other half of those rows, the three columns that hold
 * how a CV answers each one, which no amount of editing a Job Application
 * decides. The Analysis and the user's override write into the same columns
 * later; this is where that code will sit.
 */

/**
 * The only Basis anything reads or writes yet. Coverage against a Tailored CV
 * is a later effort, and it adds its own rows rather than moving these
 * (ADR-0004) — so naming it once here keeps every query that has to say which
 * readings it means saying it the same way.
 */
export const PROFILE: Basis = "profile";

/**
 * What the automatic comparison reads for one Requirement against the skill
 * list the user has accepted — or `null` where there is no list to compare it
 * against at all.
 *
 * An empty list and no Profile are one state here, and `null` is what both
 * get. A user who has uploaded nothing, and one who has uploaded a CV but not
 * yet said which of its skills are theirs, have both told us nothing; writing
 * that down as `missing` would put a verdict on every Requirement they own and
 * a "0 of 8" on every board card, and an unknown fit must not read as a bad
 * one (story 48).
 *
 * A list that the user emptied on purpose reads the same way, which is the
 * honest cost of not being able to tell it from one they never filled in.
 */
export function normalisedReadingOf(
  skill: string,
  skills: readonly string[],
): Coverage | null {
  return skills.length === 0 ? null : normalisedCoverageOf(skill, skills);
}

/**
 * Reads every one of this user's Requirements against the skill list given,
 * and writes what it finds — the whole of "the automatic reading is recomputed
 * when the Profile's skills change".
 *
 * Every Requirement the user owns, rather than one Job Application's: a skill
 * list is the user's own side of the comparison, so accepting one changes what
 * every Posting they have saved reads as.
 *
 * At most one statement per distinct reading, which is at most two, because
 * the automatic comparison can only answer `have` or `missing`. A statement
 * per row would be a round trip per Requirement over a pooled connection, and
 * a user with fifty saved Postings has hundreds.
 *
 * It takes a `Queryable` so the caller can put it in the same transaction as
 * the write that changed the skills — the two have to land together, or the
 * readings would go on describing a list the user no longer has.
 */
export async function recordNormalisedCoverage(
  queryable: Queryable,
  userId: string,
  skills: readonly string[],
): Promise<void> {
  const rows = await queryable
    .select({ id: requirements.id, skill: requirements.skill })
    .from(requirements)
    .where(
      and(eq(requirements.userId, userId), eq(requirements.basis, PROFILE)),
    );

  const byReading = new Map<Coverage | null, string[]>();
  for (const row of rows) {
    const reading = normalisedReadingOf(row.skill, skills);
    byReading.set(reading, [...(byReading.get(reading) ?? []), row.id]);
  }

  for (const [reading, ids] of byReading) {
    await queryable
      .update(requirements)
      .set({ normalisedCoverage: reading })
      // Scoped by owner as well as by the ids just read, like every other
      // query here: the ids came from a scoped read, but a statement that
      // names the owner itself is what makes that reviewable (ADR-0001).
      .where(
        and(eq(requirements.userId, userId), inArray(requirements.id, ids)),
      );
  }
}
