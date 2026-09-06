import { z } from "zod";

export { normalizeJobUrl } from "./normalize-job-url.js";
export { nearDuplicatesOf, type TitledRole } from "./near-duplicates.js";

/** The stages a job application moves through. */
export const JobStatus = z.enum([
  "bookmarked",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
]);
export type JobStatus = z.infer<typeof JobStatus>;

export const RemoteType = z.enum(["remote", "hybrid", "onsite"]);
export type RemoteType = z.infer<typeof RemoteType>;

/**
 * The stretch of time one salary figure covers. A Posting states a rate over
 * whatever period its market quotes in — annual in the UK and the US, monthly
 * across most of Poland, hourly or daily for contract work — and the figure
 * means nothing without it. It is carried beside the bounds rather than
 * normalised into a year, because annualising is arithmetic on top of what
 * the Posting said: the multiplier is a guess (twelve months or thirteen,
 * how many billable days), and the guess would be indistinguishable from the
 * Posting's own words once stored.
 */
export const SalaryPeriod = z.enum(["annual", "monthly", "daily", "hourly"]);
export type SalaryPeriod = z.infer<typeof SalaryPeriod>;

/**
 * How badly a Posting wants a Requirement. `unstated` is what a Posting that
 * names a skill without saying which it is gets, so that nothing is ever
 * guessed upward into something the Posting insisted on.
 */
export const Necessity = z.enum(["required", "preferred", "unstated"]);
export type Necessity = z.infer<typeof Necessity>;

/**
 * How well a CV answers one Requirement. Reached three ways in ascending
 * precedence — normalised comparison, Analysis, the user's own override — and
 * always measured against a `Basis` (ADR-0004).
 */
export const Coverage = z.enum(["have", "partial", "missing"]);
export type Coverage = z.infer<typeof Coverage>;

/**
 * Which CV a Coverage was measured against. Both readings coexist for one
 * Requirement, because they answer different questions (ADR-0004).
 */
export const Basis = z.enum(["profile", "tailored-cv"]);
export type Basis = z.infer<typeof Basis>;

/**
 * One thing a Posting asks of a candidate — a technology, a practice, a
 * qualification, a language, a quantity of experience — and how badly it asks
 * for it. The Coverage readings are not here: a Requirement is what the
 * Posting said, and Coverage is what a CV answers back.
 */
export const Requirement = z.object({
  skill: z.string().min(1),
  necessity: Necessity,
});
export type Requirement = z.infer<typeof Requirement>;

/**
 * A Requirement as it comes back, with what the user's CV answers to it. The
 * write shape above is what a client states; this is what it is told, and the
 * difference is the point — Coverage is computed rather than sent, and a
 * client that could state one could claim to have a skill it never showed.
 *
 * All four values are carried rather than the resolved one alone, because a
 * badge that surprises its reader has to be able to say why it reads as it
 * does: the automatic comparison, the Analysis and the user's own word are
 * each recoverable here, and `coverage` is whichever of them won (ADR-0004).
 *
 * The three readings are named as `resolvedCoverage` names them, so anything
 * holding this shape resolves through that one function rather than through a
 * second copy of the precedence order.
 */
export const RequirementWithCoverage = Requirement.extend({
  /**
   * The Requirement's own id, which the write shape has no use for — a patch
   * states the whole list, because a correction changes the skill and the
   * skill is all a client could have identified it by. It is here because
   * overriding a Coverage addresses one Requirement rather than restating the
   * list, and an address that survives a reordering has to be the row's own:
   * a position would quietly point at the neighbour of the Requirement the
   * user meant, where an id that no longer exists is a 404.
   */
  id: z.uuid(),
  /**
   * The one Coverage the three readings below amount to, and `null` where none
   * of them has spoken — a user with no Profile has nothing read about them,
   * which is not the same claim as everything being missing.
   */
  coverage: Coverage.nullable(),
  /** The automatic comparison against the Profile's accepted skill list. */
  normalisedCoverage: Coverage.nullable(),
  /** What an Analysis read, when one has been run. */
  analysedCoverage: Coverage.nullable(),
  /** The Analysis's one line on why it read the Requirement that way. */
  analysedReason: z.string().nullable(),
  /** The user's own word, which beats both of the above. */
  overriddenCoverage: Coverage.nullable(),
});
export type RequirementWithCoverage = z.infer<typeof RequirementWithCoverage>;

/**
 * What the user says of one Requirement, having disagreed with everything the
 * tracker read. It is the only Coverage a client ever states, and it beats
 * both of the readings the tracker reached on its own (ADR-0004); clearing it
 * is a request of its own rather than a null sent through here, so that
 * "I have this" and "forget what I said" cannot be confused for one another.
 */
export const SetCoverageOverride = z.object({ coverage: Coverage });
export type SetCoverageOverride = z.infer<typeof SetCoverageOverride>;

/** One Necessity's worth of whatever the caller is holding Requirements as. */
export type NecessityGroup<Asked> = {
  necessity: Necessity;
  requirements: Asked[];
};

/**
 * Requirements under the Necessity each is asked at, in the closed set's own
 * order — which runs from the Posting's insistence down to its silence, and is
 * the order a reader wants them in. A Necessity nothing is asked at gets no
 * group: an empty heading would be a claim about the Posting, and where
 * nothing at all is asked it would be three of them saying nothing.
 *
 * The list stays flat underneath and is grouped only to be read, so a
 * Requirement keeps the place it was captured in. Both surfaces that show
 * Requirements group them this way — the dashboard's section, over rows that
 * carry an editing key, and the side panel's read-only list, over the
 * contract's own Requirements — so it is written over anything that carries a
 * Necessity rather than twice.
 */
export function groupedByNecessity<Asked extends { necessity: Necessity }>(
  asked: readonly Asked[],
): NecessityGroup<Asked>[] {
  return Necessity.options
    .map((necessity) => ({
      necessity,
      requirements: asked.filter((one) => one.necessity === necessity),
    }))
    .filter(({ requirements }) => requirements.length > 0);
}

/**
 * The steps a user records how much they want a role on. The `excitement`
 * field below is the rule; this is the list, exported so that the control
 * offering the steps reads them from the contract rather than restating them.
 */
export const EXCITEMENT_SCALE = [1, 2, 3, 4, 5] as const;

/**
 * The fields of a Job Application a client owns, in their stored form — no
 * defaults, so that a persisted row missing one is an error rather than a
 * silent fill-in. Every other Job Application schema is derived from these, so
 * a validation rule is written once.
 */
const jobApplicationFields = {
  company: z.string().min(1),
  jobTitle: z.string().min(1),
  /** Null when the Job Application has no Posting: a referral, a recruiter email. */
  jobUrl: z.url().nullable(),
  location: z.string().nullable(),
  remoteType: RemoteType.nullable(),
  salaryMin: z.number().nonnegative().nullable(),
  salaryMax: z.number().nonnegative().nullable(),
  /** What the bounds above are a rate over. Null wherever no salary is recorded. */
  salaryPeriod: SalaryPeriod.nullable(),
  currency: z.string().nullable(),
  description: z.string().nullable(),
  requirements: z.array(Requirement),
  status: JobStatus,
  source: z.string().nullable(),
  appliedAt: z.iso.datetime().nullable(),
  /** Whole steps of `EXCITEMENT_SCALE`; the column that stores it is an integer. */
  excitement: z.number().int().min(1).max(5).nullable(),
  notes: z.string().nullable(),
};

type JobApplicationFields = typeof jobApplicationFields;
type JobApplicationFieldValues = {
  [K in keyof JobApplicationFields]: z.infer<JobApplicationFields[K]>;
};

/**
 * Attaches a default to each field named in `defaults`, leaving the rest
 * required. Deriving the shape this way means a field added to
 * `jobApplicationFields` cannot quietly slip past the defaults map.
 */
function withDefaults<
  Shape extends z.ZodRawShape,
  Defaults extends Partial<{ [K in keyof Shape]: z.infer<Shape[K]> }>,
>(
  shape: Shape,
  defaults: Defaults,
): {
  [K in keyof Shape]: K extends keyof Defaults
    ? z.ZodDefault<Shape[K]>
    : Shape[K];
} {
  return Object.fromEntries(
    Object.keys(shape).map((name) => {
      const field = shape[name] as z.ZodType;
      return [
        name,
        name in defaults
          ? field.default(defaults[name as keyof Defaults])
          : field,
      ];
    }),
  ) as never;
}

export const JobApplication = z.object({
  id: z.uuid(),
  userId: z.string(),
  ...jobApplicationFields,
  /**
   * Stated as bare Requirements and answered with covered ones: what a client
   * sends is what the Posting asks for, and what it gets back also carries how
   * the user's Profile reads against each one. The override after the spread
   * is what makes the two shapes differ in the one field where they should.
   */
  requirements: z.array(RequirementWithCoverage),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type JobApplication = z.infer<typeof JobApplication>;

/**
 * Shape returned by the LLM extraction endpoint — a Draft, not yet saved.
 * Every field is optional: the model fills in what the page actually says.
 */
export const JobExtraction = z
  .object(jobApplicationFields)
  .pick({
    company: true,
    jobTitle: true,
    location: true,
    remoteType: true,
    salaryMin: true,
    salaryMax: true,
    salaryPeriod: true,
    currency: true,
    description: true,
    requirements: true,
  })
  .partial();
export type JobExtraction = z.infer<typeof JobExtraction>;

/**
 * What the extraction endpoint is asked for: the Posting's URL, and the
 * visible text of the page as the extension read it. It lives in the contract
 * rather than in the API, because the extension is the only caller that will
 * ever build one and it compiles against this package.
 *
 * The text is not bounded here. How much of it the provider is shown is the
 * API's business and moves with the model; a client should send the page it
 * has and not have to guess.
 */
export const ExtractJobRequest = z.object({
  url: z.url(),
  pageText: z.string().min(1),
});
export type ExtractJobRequest = z.infer<typeof ExtractJobRequest>;

export const ExtractionFailureReason = z.enum([
  "no_job_found",
  "provider_error",
  "rate_limited",
]);
export type ExtractionFailureReason = z.infer<typeof ExtractionFailureReason>;

/**
 * What the extraction endpoint returns. It is a union rather than a bare Draft
 * because an empty Draft is indistinguishable from a successful extraction of a
 * page that has no job on it.
 */
export const ExtractJobResponse = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), draft: JobExtraction }),
  z.object({ ok: z.literal(false), reason: ExtractionFailureReason }),
]);
export type ExtractJobResponse = z.infer<typeof ExtractJobResponse>;

/**
 * The value each omitted field takes when a Job Application is created. This
 * map is the one place a create-time default is decided, so no client has to
 * send a screenful of explicit nulls to record a bookmark. A field absent from
 * here stays required — which is how `company` and `jobTitle` stay mandatory.
 */
const CREATE_DEFAULTS = {
  jobUrl: null,
  location: null,
  remoteType: null,
  salaryMin: null,
  salaryMax: null,
  salaryPeriod: null,
  currency: null,
  description: null,
  requirements: [],
  status: "bookmarked",
  source: null,
  appliedAt: null,
  excitement: null,
  notes: null,
} satisfies Partial<JobApplicationFieldValues>;

/** Creating a Job Application asks for a company and a job title, and nothing else. */
export const CreateJobApplication = z.object(
  withDefaults(jobApplicationFields, CREATE_DEFAULTS),
);
export type CreateJobApplication = z.infer<typeof CreateJobApplication>;

/**
 * A patch. Derived from the undefaulted fields rather than from
 * `CreateJobApplication`, because an omitted field here means "leave it as it
 * is", not "reset it to the create-time default".
 */
export const UpdateJobApplication = z.object(jobApplicationFields).partial();
export type UpdateJobApplication = z.infer<typeof UpdateJobApplication>;

export const Contact = z.object({
  id: z.uuid(),
  jobApplicationId: z.uuid().nullable(),
  name: z.string().min(1),
  role: z.string().nullable(),
  company: z.string().nullable(),
  email: z.email().nullable(),
  linkedinUrl: z.url().nullable(),
  notes: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type Contact = z.infer<typeof Contact>;

export const ActivityEventType = z.enum(["status_change", "note", "follow_up"]);
export type ActivityEventType = z.infer<typeof ActivityEventType>;

export const ActivityEvent = z.object({
  id: z.uuid(),
  jobApplicationId: z.uuid(),
  type: ActivityEventType,
  content: z.string(),
  createdAt: z.iso.datetime(),
});
export type ActivityEvent = z.infer<typeof ActivityEvent>;
