import {
  normalizeJobUrl,
  type CreateJobApplication,
  type JobApplication,
  type JobStatus,
  type UpdateJobApplication,
} from "@repo/schema";
import { and, desc, eq, sql } from "drizzle-orm";
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
 * Applies a patch, returning the Job Application as it now stands — or `null`
 * when this user has no such row, which is the same answer for a Job
 * Application that does not exist and one belonging to somebody else.
 *
 * A patch omitting a field leaves that field as it was; only `status` carries
 * a side effect, and only ever an additive one.
 */
export async function updateJobApplication(
  userId: string,
  id: string,
  patch: UpdateJobApplication,
): Promise<JobApplication | null> {
  // The two fields the row does not store the way the contract states them:
  // a timestamp rather than an ISO string, and a URL that drags its normalized
  // form along with it.
  const { appliedAt, jobUrl, ...fields } = patch;

  const updated = await db()
    .update(jobApplications)
    .set({
      ...fields,
      ...(appliedAt === undefined
        ? {}
        : { appliedAt: appliedAt === null ? null : new Date(appliedAt) }),
      // The stored identity has to move with the URL it is derived from, or
      // the unique index would go on guarding the Posting this Job Application
      // used to point at (ADR-0002).
      ...(jobUrl === undefined
        ? {}
        : {
            jobUrl,
            normalizedJobUrl: jobUrl === null ? null : normalizeJobUrl(jobUrl),
          }),
      ...appliedAtOnStatusChange(patch),
    })
    .where(and(eq(jobApplications.userId, userId), eq(jobApplications.id, id)))
    .returning()
    .catch((error: unknown) => {
      if (patch.jobUrl != null && isUniqueViolation(error)) {
        throw new DuplicatePostingError(patch.jobUrl);
      }
      throw error;
    });

  const [row] = updated;
  return row === undefined ? null : toJobApplication(row);
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
 * Application whose Status says otherwise.
 */
function appliedAtOnCreate(input: CreateJobApplication): Date | null {
  if (input.appliedAt !== null) return new Date(input.appliedAt);
  return input.status === "applied" ? new Date() : null;
}

/**
 * The applied date's half of a Status change. Moving to `applied` stamps the
 * date when it is unset — `coalesce` rather than a read, so nothing can slip
 * between the check and the write. Every other move contributes no column at
 * all, which is precisely what stops a move backwards, or to `rejected` or
 * `withdrawn`, from erasing when the user applied. `appliedAtAfterMove` in
 * `./applied-date` is the client's copy of this rule.
 *
 * A patch naming `appliedAt` outright has already said what it wants, and wins.
 */
function appliedAtOnStatusChange(patch: UpdateJobApplication) {
  if (patch.status !== "applied" || patch.appliedAt !== undefined) return {};
  return { appliedAt: sql`coalesce(${jobApplications.appliedAt}, now())` };
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
