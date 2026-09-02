import {
  normalizeJobUrl,
  type CreateJobApplication,
  type JobApplication,
  type JobStatus,
} from "@repo/schema";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { jobApplications, type JobApplicationRow } from "../db/schema";

/**
 * Every read and write of a Job Application. Nothing else in the app builds a
 * query, and every function here takes the owner's id as its first argument
 * rather than reading it from a session — that signature is what makes tenant
 * isolation reviewable, and it is all that enforces it (ADR-0001).
 */

/** Thrown when a Job Application already exists for this user's Posting. */
export class DuplicatePostingError extends Error {
  constructor(readonly jobUrl: string) {
    super(`This Posting is already saved: ${jobUrl}`);
    this.name = "DuplicatePostingError";
  }
}

export async function createJobApplication(
  userId: string,
  input: CreateJobApplication,
): Promise<JobApplication> {
  const rows = await db()
    .insert(jobApplications)
    .values({
      ...input,
      userId,
      // Stored rather than computed on read, so the unique index can use it.
      normalizedJobUrl:
        input.jobUrl === null ? null : normalizeJobUrl(input.jobUrl),
      appliedAt: appliedAtOnCreate(input),
    })
    .returning()
    .catch((error: unknown) => {
      if (input.jobUrl !== null && isUniqueViolation(error)) {
        throw new DuplicatePostingError(input.jobUrl);
      }
      throw error;
    });

  const [row] = rows;
  if (row === undefined) {
    throw new Error("The insert returned no Job Application.");
  }

  return toJobApplication(row);
}

export async function listJobApplications(
  userId: string,
  filter: { status?: JobStatus } = {},
): Promise<JobApplication[]> {
  const rows = await db()
    .select()
    .from(jobApplications)
    .where(
      and(
        eq(jobApplications.userId, userId),
        filter.status === undefined
          ? undefined
          : eq(jobApplications.status, filter.status),
      ),
    )
    .orderBy(desc(jobApplications.createdAt));

  return rows.map(toJobApplication);
}

/**
 * Returns whether a Job Application was removed — `false` if this user has no
 * such row. It has no endpoint until ticket 05; it exists now because the
 * tests must take their own rows away again, and a query may not live anywhere
 * but here (ADR-0001).
 */
export async function deleteJobApplication(
  userId: string,
  id: string,
): Promise<boolean> {
  const deleted = await db()
    .delete(jobApplications)
    .where(and(eq(jobApplications.userId, userId), eq(jobApplications.id, id)))
    .returning({ id: jobApplications.id });

  return deleted.length > 0;
}

/**
 * When a Job Application was applied for. One created as `applied` with no date
 * is stamped now, so the list can never show "Not applied" against a Job
 * Application whose Status says otherwise. Ticket 04 owes the same rule to a
 * Status change, where the date must also survive a later move.
 */
function appliedAtOnCreate(input: CreateJobApplication): Date | null {
  if (input.appliedAt !== null) return new Date(input.appliedAt);
  return input.status === "applied" ? new Date() : null;
}

/**
 * A row as the shared contract describes it: timestamps as ISO strings, and no
 * `normalizedJobUrl`, which is the database's business rather than a client's.
 */
function toJobApplication(row: JobApplicationRow): JobApplication {
  return {
    id: row.id,
    userId: row.userId,
    company: row.company,
    jobTitle: row.jobTitle,
    jobUrl: row.jobUrl,
    location: row.location,
    remoteType: row.remoteType,
    salaryMin: row.salaryMin,
    salaryMax: row.salaryMax,
    currency: row.currency,
    description: row.description,
    keywords: row.keywords,
    status: row.status,
    source: row.source,
    appliedAt: row.appliedAt?.toISOString() ?? null,
    excitement: row.excitement,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Postgres' `unique_violation`, wherever it sits. Drizzle wraps a driver error
 * in one carrying the failed query, so the code is a `cause` or two down
 * rather than on the error it hands you.
 */
function isUniqueViolation(error: unknown): boolean {
  const seen = new Set<unknown>();

  for (let cause = error; cause !== null && cause !== undefined;) {
    if (typeof cause !== "object" || seen.has(cause)) return false;
    if ("code" in cause && cause.code === "23505") return true;

    seen.add(cause);
    cause = "cause" in cause ? cause.cause : null;
  }

  return false;
}
