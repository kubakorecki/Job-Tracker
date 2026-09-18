import type { CreateInterview, Interview, UpdateInterview } from "@repo/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { todayInUtc } from "../day";
import { db } from "../db/client";
import { interviews, jobApplications, type InterviewRow } from "../db/schema";

/**
 * Every read and write of an Interview. Like every repository here, each
 * function takes the owner's id as its first argument rather than reading it
 * from a session — that signature is what makes tenant isolation reviewable,
 * and it is all that enforces it (ADR-0001).
 *
 * Every one of them names the Job Application as well, though a row's own id
 * would find it: it is what stops a meeting being moved or deleted by asking
 * about it through a Job Application it is not on, and it lets the endpoints
 * answer a mistyped Job Application the way every other endpoint answers one —
 * the arrangement `setOverriddenCoverage` makes for a Requirement, and for the
 * same reasons.
 *
 * Nothing here moves a Status. The user is asked and answers, and the answer is
 * an ordinary patch on the Job Application (ADR-0011) — so an Interview knows
 * nothing about where its Job Application stands, and could not move it if it
 * wanted to.
 */

/**
 * Arranges a meeting, answering with it as it now stands — or `null` where this
 * user has no such Job Application, which is the same answer for one that does
 * not exist and one belonging to somebody else.
 *
 * The ownership check and the insert are one transaction because the foreign
 * key cannot make that check for us: it holds the Job Application to a real
 * row, not to this user's. Without the check a stranger's id and this user's
 * own would insert happily, and the meeting would be visible to neither.
 *
 * `arranged_on` is filled in here where the caller named no day: today, read
 * from the endpoint's clock through the one function in the app that reads it
 * (`../day`). A client's clock could be anything, and a browser two years slow
 * would date every invitation wrong — the argument ADR-0007 makes about a
 * Closing Date's year, applied to the one date this feature stamps itself.
 */
export async function addInterview(
  userId: string,
  jobApplicationId: string,
  input: CreateInterview,
): Promise<Interview | null> {
  return db().transaction(async (tx) => {
    const owned = await tx
      .select({ id: jobApplications.id })
      .from(jobApplications)
      .where(
        and(
          eq(jobApplications.userId, userId),
          eq(jobApplications.id, jobApplicationId),
        ),
      )
      .limit(1);

    if (owned.length === 0) return null;

    const rows = await tx
      .insert(interviews)
      .values({
        ...input,
        userId,
        jobApplicationId,
        arrangedOn: input.arrangedOn ?? todayInUtc(),
      })
      .returning();

    const [row] = rows;
    if (row === undefined) {
      throw new Error("The insert returned no Interview.");
    }

    return toInterview(row);
  });
}

/**
 * One Job Application's meetings, in the order they are held. Empty for a
 * recruitment that is all still to be arranged, and empty for another user's
 * Job Application — the same answer, because neither is this user's to see.
 */
export async function interviewsFor(
  userId: string,
  jobApplicationId: string,
): Promise<Interview[]> {
  const byJobApplication = await interviewsOf(userId, [jobApplicationId]);
  return byJobApplication.get(jobApplicationId) ?? [];
}

/**
 * One user's Interviews for the Job Applications named, keyed by the Job
 * Application they belong to, in the order they are held. One query for however
 * many rows are being read, for the reason `requirementsOf` makes the same
 * arrangement: the board asks for every Job Application at once, and a query
 * per row would be a hundred round trips over a pooled connection.
 */
export async function interviewsOf(
  userId: string,
  jobApplicationIds: string[],
): Promise<Map<string, Interview[]>> {
  const byJobApplication = new Map<string, Interview[]>();
  if (jobApplicationIds.length === 0) return byJobApplication;

  const rows = await db()
    .select()
    .from(interviews)
    .where(
      and(
        eq(interviews.userId, userId),
        inArray(interviews.jobApplicationId, jobApplicationIds),
      ),
    )
    // The day first and the clock second, which is the order a reader wants
    // them in. A meeting nobody has a time for sorts last within its day —
    // Postgres puts nulls last on an ascending sort — because it is the one the
    // day cannot place, and putting it first would claim a time it has not got.
    .orderBy(
      asc(interviews.jobApplicationId),
      asc(interviews.heldOn),
      asc(interviews.heldAt),
      asc(interviews.createdAt),
    );

  for (const row of rows) {
    const list = byJobApplication.get(row.jobApplicationId) ?? [];
    list.push(toInterview(row));
    byJobApplication.set(row.jobApplicationId, list);
  }

  return byJobApplication;
}

/**
 * Applies a patch to one meeting, answering with it as it now stands — or
 * `null` where this user has no such Interview on that Job Application.
 *
 * A patch omitting a field leaves that field as it was, so rescheduling says
 * only the new day and cancelling says only that it was called off. Calling one
 * off is an edit rather than an address of its own, because a cancelled meeting
 * keeps its place and all of its details (`CONTEXT.md`).
 */
export async function updateInterview(
  userId: string,
  jobApplicationId: string,
  interviewId: string,
  patch: UpdateInterview,
): Promise<Interview | null> {
  const rows = await db()
    .update(interviews)
    .set(
      // A patch that named nothing leaves this statement no column of its own
      // to write, and an update with no columns is one Postgres has no syntax
      // for. The stamp is the honest thing to put there, as it is on a Job
      // Application: the row still has to come back so the caller can tell a
      // patch that changed nothing from a 404.
      Object.keys(patch).length === 0 ? { updatedAt: new Date() } : patch,
    )
    .where(
      and(
        eq(interviews.userId, userId),
        eq(interviews.jobApplicationId, jobApplicationId),
        eq(interviews.id, interviewId),
      ),
    )
    .returning();

  const [row] = rows;
  return row === undefined ? null : toInterview(row);
}

/**
 * Returns whether a meeting was removed — `false` where this user has no such
 * Interview on that Job Application, so a caller can answer a stranger's id the
 * same way it answers one that never existed.
 *
 * Deleting is for a meeting that was recorded by mistake. A meeting the
 * employer called off is cancelled rather than deleted, which is what keeps it
 * in the month's Activity Report as something that happened.
 */
export async function deleteInterview(
  userId: string,
  jobApplicationId: string,
  interviewId: string,
): Promise<boolean> {
  const deleted = await db()
    .delete(interviews)
    .where(
      and(
        eq(interviews.userId, userId),
        eq(interviews.jobApplicationId, jobApplicationId),
        eq(interviews.id, interviewId),
      ),
    )
    .returning({ id: interviews.id });

  return deleted.length > 0;
}

/**
 * A row as the shared contract describes it: no `user_id`, which is the
 * database's business rather than a client's, and no stamps — the two dates
 * worth knowing about a meeting are the day it is held and the day it was
 * arranged, and both of those are the user's own.
 *
 * The time of day is cut to the minute. The column answers `14:30:00`, the
 * contract states `HH:MM`, and the box that records one emits exactly that — so
 * this is where the three are made to agree rather than in each reader.
 */
function toInterview(row: InterviewRow): Interview {
  return {
    id: row.id,
    jobApplicationId: row.jobApplicationId,
    heldOn: row.heldOn,
    heldAt: row.heldAt === null ? null : row.heldAt.slice(0, 5),
    stage: row.stage,
    meetingUrl: row.meetingUrl,
    location: row.location,
    notes: row.notes,
    arrangedOn: row.arrangedOn,
    cancelled: row.cancelled,
  };
}
