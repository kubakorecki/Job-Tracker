import { z } from "zod";

export { normalizeJobUrl } from "./normalize-job-url.js";

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
  currency: z.string().nullable(),
  description: z.string().nullable(),
  keywords: z.array(z.string()),
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
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type JobApplication = z.infer<typeof JobApplication>;

/**
 * Shape returned by the LLM extraction endpoint — a Draft, not yet saved.
 * Every field is optional: the model fills in what the page actually says.
 */
export const JobExtraction = JobApplication.pick({
  company: true,
  jobTitle: true,
  location: true,
  remoteType: true,
  salaryMin: true,
  salaryMax: true,
  currency: true,
  description: true,
  keywords: true,
}).partial();
export type JobExtraction = z.infer<typeof JobExtraction>;

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
  currency: null,
  description: null,
  keywords: [],
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
