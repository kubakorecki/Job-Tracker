import type {
  Basis,
  Coverage,
  Requirement,
  RequirementWithCoverage,
} from "@repo/schema";
import { and, eq, inArray } from "drizzle-orm";
import { db, type Queryable } from "../db/client";
import { requirements } from "../db/schema";
import { normalisedCoverageOf, resolvedCoverage } from "./compare";

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

/**
 * Records the user's own word about one Requirement, or takes it back when
 * given `null`, and answers with the Requirement as it now reads — `null`
 * where this user has no such Requirement on that Job Application, which is
 * the same answer for one that never existed and one belonging to somebody
 * else.
 *
 * It writes the override column and nothing else, which is the whole of "an
 * override survives a re-run": an Analysis writes the analysed reading, this
 * writes the user's, and neither can reach the other's column. Clearing is the
 * same statement with `null`, so reverting costs nothing and recomputes
 * nothing — the readings the override outranked were never disturbed, and the
 * row goes back to reading as whichever of them is highest (ADR-0004).
 *
 * The Job Application is named as well as the Requirement, though the
 * Requirement's id alone would find the row: it is what makes an override
 * addressed at one Job Application unable to land on another's Requirement,
 * and it lets the endpoint answer a mistyped Job Application the way every
 * other endpoint answers one.
 */
export async function setOverriddenCoverage(
  userId: string,
  jobApplicationId: string,
  requirementId: string,
  coverage: Coverage | null,
): Promise<RequirementWithCoverage | null> {
  const rows = await db()
    .update(requirements)
    .set({ overriddenCoverage: coverage })
    .where(
      and(
        eq(requirements.userId, userId),
        eq(requirements.jobApplicationId, jobApplicationId),
        eq(requirements.id, requirementId),
        eq(requirements.basis, PROFILE),
      ),
    )
    .returning();

  const [row] = rows;
  return row === undefined ? null : withCoverage(row);
}

/**
 * Records what an Analysis read of one Requirement, and answers with the
 * Requirement as it now stands — `null` where this user has no such row.
 *
 * It writes the analysed reading and its reason, and reaches no further: the
 * override is a column this cannot touch, which is what makes re-running an
 * Analysis unable to destroy the user's last word (ADR-0004). The precedence
 * that then hides this reading is applied on read, so nothing here has to know
 * whether the user has already overruled it.
 *
 * Nothing in the application calls it yet — the Analysis that will is its own
 * ticket. It is here rather than in the test that needs it because a query
 * that names its owner is what tenant isolation is made of (ADR-0001), and a
 * write built somewhere else would not be one.
 */
export async function recordAnalysedCoverage(
  userId: string,
  requirementId: string,
  reading: { coverage: Coverage; reason: string },
): Promise<RequirementWithCoverage | null> {
  const rows = await db()
    .update(requirements)
    .set({
      analysedCoverage: reading.coverage,
      analysedReason: reading.reason,
    })
    .where(
      and(
        eq(requirements.userId, userId),
        eq(requirements.id, requirementId),
        eq(requirements.basis, PROFILE),
      ),
    )
    .returning();

  const [row] = rows;
  return row === undefined ? null : withCoverage(row);
}

/**
 * A Requirement row as a client is told it: what the Posting asked, the three
 * readings side by side, and the one Coverage they amount to.
 *
 * The resolved value is computed here rather than stored, so that the badge on
 * the detail page, the ring on a board card and the API's own answer all come
 * from `resolvedCoverage` and cannot disagree (ADR-0004). It lives with the
 * columns rather than with the rows, because every write of a reading answers
 * with the Requirement it changed and they would otherwise each carry their
 * own copy of the precedence order.
 */
export function withCoverage(
  row: Requirement & { id: string } & CoverageColumns,
): RequirementWithCoverage {
  return {
    id: row.id,
    skill: row.skill,
    necessity: row.necessity,
    coverage: resolvedCoverage(row),
    normalisedCoverage: row.normalisedCoverage,
    analysedCoverage: row.analysedCoverage,
    analysedReason: row.analysedReason,
    overriddenCoverage: row.overriddenCoverage,
  };
}

/** The four columns this module owns, as any row carrying them holds them. */
type CoverageColumns = {
  normalisedCoverage: Coverage | null;
  analysedCoverage: Coverage | null;
  analysedReason: string | null;
  overriddenCoverage: Coverage | null;
};
