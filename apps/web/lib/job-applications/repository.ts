import {
  normalizeJobUrl,
  type CreateJobApplication,
  type Interview,
  type JobApplication,
  type JobStatus,
  type Requirement,
  type RequirementWithCoverage,
  type UpdateJobApplication,
} from "@repo/schema";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  normalisedReadingOf,
  PROFILE,
  withCoverage,
} from "../coverage/repository";
import { db, type Transaction } from "../db/client";
import {
  jobApplications,
  requirements,
  type JobApplicationRow,
} from "../db/schema";
import { interviewsFor, interviewsOf } from "../interviews/repository";
import { acceptedSkills } from "../profile/repository";
import { recordStatusChange } from "../status-changes/repository";

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
  // The Requirements are their own table, so the Job Application and its asks
  // are two writes; one transaction is what stops a failure between them
  // leaving a Job Application that has silently lost what the Posting asked
  // for.
  const { requirements: asks, ...fields } = input;

  // What the automatic reading is measured against, read once and before the
  // transaction: the Profile's skill list is the user's own side of the
  // comparison and has nothing to do with this Job Application, so it is not
  // something the write has to hold a lock over.
  const skills = await acceptedSkills(userId);

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

      // Being saved somewhere is how a Job Application came to stand there, so
      // creation records a Status Change like any other move — an extension
      // save that lands in `applied` above all, which is the one the Activity
      // Report is most often made of. A bookmark records one too: `bookmarked`
      // is where the user put it, and a history that began only once something
      // interesting happened could not say when the rest began.
      await recordStatusChange(tx, userId, row.id, row.status);

      return {
        row,
        asks: await replaceRequirements(tx, userId, row.id, asks, skills),
      };
    })
    .catch((error: unknown) => {
      if (input.jobUrl !== null && isUniqueViolation(error)) {
        throw new DuplicatePostingError(input.jobUrl);
      }
      throw error;
    });

  // A Job Application that has just been saved has no meetings arranged on it:
  // an Interview is added at its own address, and there has been no chance to.
  return toJobApplication(created.row, created.asks, []);
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

  // Both lists in one query apiece, rather than two per row: the board reads
  // every Job Application the user has, and each of them draws a fit ring off
  // the Requirements and a silence off the Interviews.
  const ids = rows.map((row) => row.id);
  const [asks, held] = await Promise.all([
    requirementsOf(userId, ids),
    interviewsOf(userId, ids),
  ]);

  return rows.map((row) =>
    toJobApplication(row, asks.get(row.id) ?? [], held.get(row.id) ?? []),
  );
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

  const [asks, held] = await Promise.all([
    requirementsFor(userId, row.id),
    interviewsFor(userId, row.id),
  ]);

  return toJobApplication(row, asks, held);
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

  // Only a patch that restates the Requirements has anything to read them
  // against; one that leaves them alone leaves their readings alone too.
  const skills = asks === undefined ? [] : await acceptedSkills(userId);

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
      // Where it stood before this patch, read under a lock so that nothing
      // can move it between the reading and the write — which is what makes
      // "it moved" a fact rather than a guess. Only a patch that names a
      // Status pays for the statement.
      const stood =
        patch.status === undefined
          ? undefined
          : await statusBefore(tx, userId, id);

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

      // One row per move, and only where the Job Application actually moved: a
      // form saved with the Status it already had, or a card dropped back into
      // the column it came from, has moved nothing, and a row for it would
      // print in the Activity Report as something that happened. A move back
      // to a Status the Job Application has stood at before is a move, and
      // gets its own row.
      if (patch.status !== undefined && row.status !== stood) {
        await recordStatusChange(tx, userId, row.id, row.status);
      }

      // A patch that never named the Requirements leaves them alone; one that
      // named them states the whole list, so what it does not carry is gone.
      return {
        row,
        asks:
          asks === undefined
            ? undefined
            : await replaceRequirements(tx, userId, row.id, asks, skills),
      };
    })
    .catch((error: unknown) => {
      if (patch.jobUrl != null && isUniqueViolation(error)) {
        throw new DuplicatePostingError(patch.jobUrl);
      }
      throw error;
    });

  if (updated === null) return null;

  // A patch that stated the Requirements has already had them written, and the
  // write answered with how each one reads; only one that left them alone has
  // to go and look. The Interviews are always read: no patch can name them —
  // they are added and corrected one at a time at their own address — and the
  // answer still has to carry them, because the page this answers reads a
  // silence off them.
  const [written, held] = await Promise.all([
    updated.asks ?? requirementsFor(userId, updated.row.id),
    interviewsFor(userId, updated.row.id),
  ]);

  return toJobApplication(updated.row, written, held);
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
 * Where one Job Application stands, read inside the transaction that is about
 * to move it and locked until that transaction ends — so the Status recorded
 * as having been left is the one the update actually leaves.
 *
 * `undefined` means there is no such row of this user's, which the update then
 * answers as a 404 on its own; it is never asked at all for a patch that names
 * no Status, and the caller asks `patch.status` rather than this to tell those
 * two apart.
 */
async function statusBefore(
  tx: Transaction,
  userId: string,
  id: string,
): Promise<JobStatus | undefined> {
  const rows = await tx
    .select({ status: jobApplications.status })
    .from(jobApplications)
    .where(and(eq(jobApplications.userId, userId), eq(jobApplications.id, id)))
    .limit(1)
    .for("update");

  return rows[0]?.status;
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
): Promise<Map<string, RequirementWithCoverage[]>> {
  const byJobApplication = new Map<string, RequirementWithCoverage[]>();
  if (jobApplicationIds.length === 0) return byJobApplication;

  const rows = await db()
    .select({
      jobApplicationId: requirements.jobApplicationId,
      id: requirements.id,
      skill: requirements.skill,
      necessity: requirements.necessity,
      normalisedCoverage: requirements.normalisedCoverage,
      analysedCoverage: requirements.analysedCoverage,
      analysedReason: requirements.analysedReason,
      overriddenCoverage: requirements.overriddenCoverage,
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
    list.push(withCoverage(requirement));
    byJobApplication.set(jobApplicationId, list);
  }

  return byJobApplication;
}

/**
 * One Job Application's Requirements, in the order they were captured in, with
 * how each one reads. Exported for the Analysis, which has just rewritten the
 * verdicts on them and has to answer with the list as it now stands.
 */
export async function requirementsFor(
  userId: string,
  jobApplicationId: string,
): Promise<RequirementWithCoverage[]> {
  const byJobApplication = await requirementsOf(userId, [jobApplicationId]);
  return byJobApplication.get(jobApplicationId) ?? [];
}

/**
 * When what this Posting asks for last changed — the newest of its
 * Requirements — or `null` for a Job Application that asks for nothing.
 *
 * `created_at` rather than `updated_at`, and it works because of how
 * `replaceRequirements` below writes: the list is replaced wholesale on every
 * edit, so every row is new whenever the asks change. `updated_at` answers a
 * different question — setting or clearing an override writes the row — and an
 * Analysis marked stale for that reason would be asking for a model call
 * because its own verdict was overruled (ADR-0004).
 *
 * It sits here rather than with the Analysis that reads it because it is the
 * shadow of that write: the two have to keep saying the same thing about what
 * counts as a change, and they are worth reading side by side.
 */
export async function requirementsChangedAt(
  userId: string,
  jobApplicationId: string,
): Promise<Date | null> {
  const rows = await db()
    .select({ createdAt: requirements.createdAt })
    .from(requirements)
    .where(
      and(
        eq(requirements.userId, userId),
        eq(requirements.jobApplicationId, jobApplicationId),
        eq(requirements.basis, PROFILE),
      ),
    )
    .orderBy(desc(requirements.createdAt))
    .limit(1);

  return rows[0]?.createdAt ?? null;
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
  skills: readonly string[],
): Promise<RequirementWithCoverage[]> {
  await tx
    .delete(requirements)
    .where(
      and(
        eq(requirements.userId, userId),
        eq(requirements.jobApplicationId, jobApplicationId),
        eq(requirements.basis, PROFILE),
      ),
    );

  if (asks.length === 0) return [];

  // The automatic reading is written here rather than swept up afterwards,
  // which is what makes it there the moment a Posting is saved: it costs no
  // model call and no second statement, so there is nothing to defer.
  const written = await tx
    .insert(requirements)
    .values(
      asks.map((requirement, position) => ({
        ...requirement,
        userId,
        jobApplicationId,
        position,
        basis: PROFILE,
        normalisedCoverage: normalisedReadingOf(requirement.skill, skills),
        // A row that has just been written has had nothing else read against
        // it. The Analysis and the override are the user's to ask for, and
        // neither survives the skill they were about being rewritten.
        analysedCoverage: null,
        analysedReason: null,
        overriddenCoverage: null,
      })),
    )
    // The rows come back rather than being answered from what went in, because
    // the id is the database's to give and a client needs it to address one
    // Requirement — which is what setting an override does.
    .returning();

  // Put back in the order they were captured in: `returning` answers in
  // whatever order the rows were written, which is the order they went in
  // today and is nothing the database promises.
  return [...written]
    .sort((one, other) => one.position - other.position)
    .map(withCoverage);
}

/**
 * A row as the shared contract describes it: timestamps as ISO strings, and no
 * `normalizedJobUrl`, which is the database's business rather than a client's.
 * The Requirements and the Interviews arrive alongside, from their own tables.
 */
function toJobApplication(
  row: JobApplicationRow,
  asks: RequirementWithCoverage[],
  held: Interview[],
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
    salaryPeriod: row.salaryPeriod,
    currency: row.currency,
    description: row.description,
    closesOn: row.closesOn,
    requirements: asks,
    interviews: held,
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
