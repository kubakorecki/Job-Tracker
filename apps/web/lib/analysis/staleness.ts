import type { JobStatus } from "@repo/schema";

/**
 * Whether an Analysis has stopped describing the world, and whether saying so
 * is worth the user's attention.
 *
 * Both are arithmetic over four values, with no database access and no model
 * call, for the reason `coverage/compare.ts` is: the banner on the detail page
 * and the endpoint's own answer come from one function and so cannot disagree.
 */

/**
 * The Statuses staleness is mentioned under. Past `applied` there is nothing
 * the user can do about a CV that has moved on — the application is with
 * somebody else — so a banner offering a re-run would be asking them to spend
 * a model call on a document they can no longer send (story 35).
 *
 * `bookmarked` and `applied` rather than "not `interviewing` or later",
 * because `rejected` and `withdrawn` are past acting on too and neither is
 * later than anything.
 */
const STALENESS_IS_WORTH_SAYING: readonly JobStatus[] = [
  "bookmarked",
  "applied",
];

/**
 * What an Analysis is read against to know whether it still stands: when it
 * ran, and when the two things it read last moved.
 *
 * Both stamps are nullable because both things can be absent — a user with no
 * Profile, a Job Application asking for nothing — and absent is not a change.
 */
export type Standing = {
  /** When the model last answered about this Job Application. */
  ranAt: Date;
  /**
   * When the Profile last moved: a new document, or an edited skill list.
   * Both change what an Analysis was measured against, which is why the
   * Profile keeps one stamp for either.
   */
  profileChangedAt: Date | null;
  /**
   * When what this Posting asks for last changed. Which stamp answers that,
   * and why it is not the one an override moves, is decided beside the write
   * it is the shadow of — `requirementsChangedAt` in
   * `job-applications/repository.ts`.
   */
  requirementsChangedAt: Date | null;
  /** Where the Job Application sits in the pipeline, which decides whether to say. */
  status: JobStatus;
};

/**
 * Whether this Analysis is stale, as the user is told it: two questions
 * answered as one, because they only ever matter together — has something
 * moved under it (ADR-0004's rule, `hasBeenOvertaken`), and is the user in a
 * position to act on that (`worthTelling`).
 *
 * One value rather than two, because a client renders staleness rather than
 * deciding it: the banner, the greyed-out verdicts and this endpoint would
 * otherwise each have to remember the Status rule, and the one that forgot
 * would nag about a Job Application the user cannot act on. The two halves are
 * named separately below so that a surface which one day needs only the first
 * can ask for it rather than reimplementing it.
 *
 * Derived on every read rather than stored (ADR-0004). A flag would have to be
 * unset by every write that could invalidate it — a CV upload, an accepted
 * skill list, an edited Requirement — and the one that forgot would leave a
 * verdict about a document that no longer exists reading as current.
 */
export function isStale(standing: Standing): boolean {
  return worthTelling(standing.status) && hasBeenOvertaken(standing);
}

/**
 * Whether anything an Analysis read has moved since it ran — the whole of what
 * ADR-0004 calls stale, with no view about whether it is worth saying.
 *
 * A stamp equal to the run's is not a change: an Analysis reads the Profile
 * and then records itself, so the two landing in the same instant is what one
 * ordinary run looks like rather than something happening underneath it. A
 * stamp that is absent is not a change either — there is nothing carrying a
 * later one.
 */
export function hasBeenOvertaken({
  ranAt,
  profileChangedAt,
  requirementsChangedAt,
}: Standing): boolean {
  return [profileChangedAt, requirementsChangedAt].some(
    (changedAt) => changedAt !== null && changedAt > ranAt,
  );
}

/** Whether this Job Application is one the user could still act on. */
function worthTelling(status: JobStatus): boolean {
  return STALENESS_IS_WORTH_SAYING.includes(status);
}
