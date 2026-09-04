import {
  normalizeJobUrl,
  type Basis,
  type CreateJobApplication,
  type JobApplication,
  type JobStatus,
  type Requirement,
  type UpdateJobApplication,
} from "@repo/schema";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  jobApplications,
  requirements,
  type JobApplicationRow,
} from "../db/schema";

/**
 * Every read and write of a Job Application. Nothing else in the app builds a
 * query, and every function here takes the owner's id as its first argument
 * rather than reading it from a session — that signature is what makes tenant
 * isolation reviewable, and it is all that enforces it (ADR-0001).
 */

/**
 * The only Basis anything reads or writes here. Coverage against a Tailored CV
 * is a later effort, and it adds its own rows rather than moving these
 * (ADR-0004) — so a Job Application's Requirements are exactly the rows
 * measured against the Profile, and naming that here keeps the read from
 * doubling once the second Basis exists.
 */
const PROFILE: Basis = "profile";

/** The handle a `db().transaction` callback is given, read off the client. */
type Transaction = Parameters<
  Parameters<ReturnType<typeof db>["transaction"]>[0]
>[0];

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
  // The Requirements are their own table, so the Job Application and its asks
  // are two writes; one transaction is what stops a failure between them
  // leaving a Job Application that has silently lost what the Posting asked
  // for.
  const { requirements: asks, ...fields } = input;

  const created = await db()
    .transaction(async (tx) => {
      const rows = await tx
        .insert(jobApplications)
        .values({
          ...fields,
          userId,
          // Stored rather than computed on read, so the unique index can use it.
          normalizedJobUrl:
            input.jobUrl === null ? null : normalizeJobUrl(input.jobUrl),
          appliedAt: appliedAtOnCreate(input),
        })
        .returning();

      const [row] = rows;
      if (row === undefined) {
        throw new Error("The insert returned no Job Application.");
      }

      await replaceRequirements(tx, userId, row.id, asks);
      return row;
    })
    .catch((error: unknown) => {
      if (input.jobUrl !== null && isUniqueViolation(error)) {
        throw new DuplicatePostingError(input.jobUrl);
      }
      throw error;
    });

  return toJobApplication(created, asks);
}

/**
 * What a caller may narrow the list to. `jobUrl` is a Posting's address in
 * whatever form the caller reached it — normalized here, next to the write
 * that normalized what it stored, so the lookup and the row can never be
 * matched by two different rules (ADR-0002).
 */
export type JobApplicationQuery = { status?: JobStatus; jobUrl?: string };

export async function listJobApplications(
  userId: string,
  query: JobApplicationQuery = {},
): Promise<JobApplication[]> {
  const rows = await db()
    .select()
    .from(jobApplications)
    .where(
      and(
        eq(jobApplications.userId, userId),
        query.status === undefined
          ? undefined
          : eq(jobApplications.status, query.status),
        query.jobUrl === undefined
          ? undefined
          : eq(jobApplications.normalizedJobUrl, normalizeJobUrl(query.jobUrl)),
      ),
    )
    .orderBy(desc(jobApplications.createdAt));

  const asks = await requirementsOf(
    userId,
    rows.map((row) => row.id),
  );
  return rows.map((row) => toJobApplication(row, asks.get(row.id) ?? []));
}

/**
 * One Job Application, or `null` when this user has no such row — which is the
 * same answer for one that does not exist and one belonging to somebody else,
 * so that a caller cannot tell a stranger's row apart from a missing one.
 */
export async function getJobApplication(
  userId: string,
  id: string,
): Promise<JobApplication | null> {
  const rows = await db()
    .select()
    .from(jobApplications)
    .where(and(eq(jobApplications.userId, userId), eq(jobApplications.id, id)))
    .limit(1);

  const [row] = rows;
  if (row === undefined) return null;

  return toJobApplication(row, await requirementsFor(userId, row.id));
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
  // The three fields the row does not store the way the contract states them:
  // a timestamp rather than an ISO string, a URL that drags its normalized form
  // along with it, and the Requirements, which are a table of their own.
  const { appliedAt, jobUrl, requirements: asks, ...fields } = patch;

  const columns = {
    ...fields,
    ...(appliedAt === undefined
      ? {}
      : { appliedAt: appliedAt === null ? null : new Date(appliedAt) }),
    // The stored identity has to move with the URL it is derived from, or the
    // unique index would go on guarding the Posting this Job Application used
    // to point at (ADR-0002).
    ...(jobUrl === undefined
      ? {}
      : {
          jobUrl,
          normalizedJobUrl: jobUrl === null ? null : normalizeJobUrl(jobUrl),
        }),
    ...appliedAtOnStatusChange(patch),
  };

  const updated = await db()
    .transaction(async (tx) => {
      const rows = await tx
        .update(jobApplications)
        .set(
          // A patch that named only the Requirements leaves this statement no
          // column of its own to write, and an update with no columns is one
          // Postgres has no syntax for. The stamp is the honest thing to put
          // there: the Job Application did change, and the row still has to
          // come back so the caller can tell a correction from a 404.
          Object.keys(columns).length === 0
            ? { updatedAt: new Date() }
            : columns,
        )
        .where(
          and(eq(jobApplications.userId, userId), eq(jobApplications.id, id)),
        )
        .returning();

      const [row] = rows;
      if (row === undefined) return null;

      // A patch that never named the Requirements leaves them alone; one that
      // named them states the whole list, so what it does not carry is gone.
      if (asks !== undefined)
        await replaceRequirements(tx, userId, row.id, asks);
      return row;
    })
    .catch((error: unknown) => {
      if (patch.jobUrl != null && isUniqueViolation(error)) {
        throw new DuplicatePostingError(patch.jobUrl);
      }
      throw error;
    });

  if (updated === null) return null;

  // A patch that stated the Requirements has already said what they are; only
  // one that left them alone has to go and look.
  return toJobApplication(
    updated,
    asks ?? (await requirementsFor(userId, updated.id)),
  );
}

/**
 * Returns whether a Job Application was removed — `false` if this user has no
 * such row, so a caller can answer a stranger's id the same way it answers one
 * that never existed.
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
 * One user's Requirements for the Job Applications named, keyed by the Job
 * Application they belong to, in the order they were captured in. One query
 * for however many rows are being read, because the list view asks for every
 * Job Application at once and a query per row would be a hundred round trips
 * over a pooled connection.
 *
 * Scoped by owner as well as by Job Application, like every other query here:
 * the caller has already read rows that were scoped by user, but a query that
 * names the owner itself is what makes that reviewable (ADR-0001).
 */
async function requirementsOf(
  userId: string,
  jobApplicationIds: string[],
): Promise<Map<string, Requirement[]>> {
  const byJobApplication = new Map<string, Requirement[]>();
  if (jobApplicationIds.length === 0) return byJobApplication;

  const rows = await db()
    .select({
      jobApplicationId: requirements.jobApplicationId,
      skill: requirements.skill,
      necessity: requirements.necessity,
    })
    .from(requirements)
    .where(
      and(
        eq(requirements.userId, userId),
        inArray(requirements.jobApplicationId, jobApplicationIds),
        eq(requirements.basis, PROFILE),
      ),
    )
    .orderBy(asc(requirements.jobApplicationId), asc(requirements.position));

  for (const { jobApplicationId, ...requirement } of rows) {
    const list = byJobApplication.get(jobApplicationId) ?? [];
    list.push(requirement);
    byJobApplication.set(jobApplicationId, list);
  }

  return byJobApplication;
}

/** One Job Application's Requirements, in the order they were captured in. */
async function requirementsFor(
  userId: string,
  jobApplicationId: string,
): Promise<Requirement[]> {
  const byJobApplication = await requirementsOf(userId, [jobApplicationId]);
  return byJobApplication.get(jobApplicationId) ?? [];
}

/**
 * Makes one Job Application's Requirements exactly the list it was given.
 * Written as a delete and an insert rather than a diff: the list is short, its
 * order is part of what it says, and a Requirement has no identity of its own
 * that a client could name — the skill is what identifies it, and the skill is
 * the thing a correction changes.
 *
 * The Coverage readings go with the row that held them, which is right for a
 * skill whose wording changed and is why nothing here tries to carry them
 * across; recomputing the normalised one is the job of the code that writes it.
 */
async function replaceRequirements(
  tx: Transaction,
  userId: string,
  jobApplicationId: string,
  asks: Requirement[],
): Promise<void> {
  await tx
    .delete(requirements)
    .where(
      and(
        eq(requirements.userId, userId),
        eq(requirements.jobApplicationId, jobApplicationId),
        eq(requirements.basis, PROFILE),
      ),
    );

  if (asks.length === 0) return;

  await tx.insert(requirements).values(
    asks.map((requirement, position) => ({
      userId,
      jobApplicationId,
      position,
      skill: requirement.skill,
      necessity: requirement.necessity,
      basis: PROFILE,
    })),
  );
}

/**
 * A row as the shared contract describes it: timestamps as ISO strings, and no
 * `normalizedJobUrl`, which is the database's business rather than a client's.
 * The Requirements arrive alongside, from their own table.
 */
function toJobApplication(
  row: JobApplicationRow,
  asks: Requirement[],
): JobApplication {
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
    requirements: asks,
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
