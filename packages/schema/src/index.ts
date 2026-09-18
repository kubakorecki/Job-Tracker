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
 * The fields of one Interview a client owns, in their stored form. The three
 * shapes below are derived from these, so a rule about what a meeting may say
 * is written once.
 *
 * It stands here, above the Job Application, because a Job Application reads
 * its Interviews and a shape has to exist before something can hold it. The
 * record of what happened it belongs beside is `StatusChange`, at the foot of
 * the file.
 */
const interviewFields = {
  /**
   * The day the meeting is held. A calendar day rather than an instant, for
   * the reason a Closing Date is one (ADR-0007): an interview is arranged for
   * a day, and a timestamp would have to choose a zone to hold it in — after
   * which nothing could tell the invention from what the invitation said. It
   * is `z.iso.date()`, which is the identical string an `<input type="date">`
   * holds, so the form needs no conversion in either direction.
   */
  heldOn: z.iso.date(),
  /**
   * The time of day it starts, where the user knows it. Its own optional field
   * beside the day rather than folded into it, which is the whole of what
   * keeps the day above a day: a meeting whose time nobody wrote down would
   * otherwise have to be stored at some invented hour, and "9am" and "we will
   * confirm the time" would be indistinguishable afterwards.
   *
   * To the minute, and no finer. `z.iso.time({ precision: -1 })` is the
   * `HH:MM` an `<input type="time">` emits, and no appointment was ever made
   * to the second — which also keeps one canonical wording of a time, since
   * the column it is read out of would otherwise answer `14:30:00`.
   */
  heldAt: z.iso.time({ precision: -1 }).nullable(),
  /**
   * What kind of meeting it is, in the user's own words — "phone screen",
   * "take-home review", "final round with the CTO". Deliberately not a closed
   * set: every employer has its own ladder and its own names for the rungs,
   * and a vocabulary of ours would make the user translate theirs into it. It
   * is what the Activity Report prints beside `Rozmowa kwalifikacyjna`, so it
   * is the one field of an Interview that is never blank.
   */
  stage: z.string().min(1),
  /** Where an online meeting is: the link out of the invitation. */
  meetingUrl: z.url().nullable(),
  /**
   * Where a meeting in a room is. Its own field rather than the Job
   * Application's `location`, which says where the job is: a Warsaw job holds
   * its second round in London, and the first is on a video call from either.
   */
  location: z.string().nullable(),
  /** Whatever the user noted about it — who they met, what was asked. */
  notes: z.string().nullable(),
  /**
   * The day the meeting was arranged, which is a separate fact from the day it
   * is held: the invitation and the interview often fall in different months,
   * and the Activity Report has to report each in the month it happened in.
   *
   * The user's to correct, because an invitation that arrived last week is not
   * news from today. A day rather than an instant, like the day held above.
   */
  arrangedOn: z.iso.date(),
  /**
   * Whether the meeting was called off. A meeting that was cancelled keeps its
   * place, marked, because arranging it was still something the employer did —
   * so this is a marker on the Interview rather than a reason to delete one.
   *
   * When it was called off is deliberately not recorded. Nobody is asked for
   * that date, so the only honest thing to do with a cancelled meeting is stop
   * counting from it: it neither ends a silence nor starts one.
   */
  cancelled: z.boolean(),
};

/**
 * One meeting in one Job Application's recruitment: the day it is held, the
 * user's own word for the stage it is, and the day it was arranged.
 *
 * Arranging one never moves the Status. The user is asked and answers, because
 * a Status is where they put a Job Application and is never inferred — a coffee
 * with a recruiter is a meeting and not a recruitment, and a call booked and
 * then cancelled leaves a Job Application that never reached `interviewing`
 * (ADR-0011).
 */
export const Interview = z.object({
  id: z.uuid(),
  jobApplicationId: z.uuid(),
  ...interviewFields,
});
export type Interview = z.infer<typeof Interview>;

/**
 * What an omitted field means when an Interview is arranged: nothing recorded,
 * and a meeting that is still on. `arrangedOn` is not in here and is not
 * defaulted below — see `CreateInterview`.
 */
const CREATE_INTERVIEW_DEFAULTS = {
  heldAt: null,
  meetingUrl: null,
  location: null,
  notes: null,
  cancelled: false,
} satisfies Partial<{
  [K in keyof typeof interviewFields]: z.infer<(typeof interviewFields)[K]>;
}>;

/**
 * Arranging an Interview asks for the day and the stage, and will take the
 * rest of what the invitation said.
 *
 * `arrangedOn` is optional rather than defaulted: today is not something a
 * contract can know, and a client's clock could be anything — a browser two
 * years slow would date every invitation wrong, which is the argument ADR-0007
 * makes about reading a Closing Date's year. Omitted, it is the day the
 * endpoint is asked on; the form states it, because it shows the day and lets
 * the user correct it to the day the invitation actually arrived.
 */
export const CreateInterview = z.object({
  ...withDefaults(interviewFields, CREATE_INTERVIEW_DEFAULTS),
  arrangedOn: interviewFields.arrangedOn.optional(),
});
export type CreateInterview = z.infer<typeof CreateInterview>;

/**
 * A correction to one Interview: a rescheduled day, a time that has since been
 * confirmed, a note after the meeting — and the cancellation, which is an edit
 * like any other rather than an address of its own, because a meeting called
 * off keeps its place and its details.
 *
 * Derived from the undefaulted fields, so an omitted field means "leave it as
 * it is" rather than "put it back to nothing".
 */
export const UpdateInterview = z.object(interviewFields).partial();
export type UpdateInterview = z.infer<typeof UpdateInterview>;

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
  /**
   * The day the Posting stops accepting applications, as the Posting states
   * it. A calendar day rather than an instant: a Posting states a date, and
   * storing an instant would invent a time of day nobody wrote down
   * (ADR-0007). Null wherever the Posting named no Closing Date, or there is
   * no Posting to name one.
   */
  closesOn: z.iso.date().nullable(),
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
  /**
   * The meetings this recruitment is made of, in the order they are held.
   *
   * Read here and written nowhere near here: `CreateJobApplication` and
   * `UpdateJobApplication` below have no `interviews` field at all, because an
   * Interview is added, corrected, called off and deleted one at a time at its
   * own address. A patch that restated the list — the way one restates the
   * Requirements — would make deleting a meeting something a stale form could
   * do by leaving it out.
   *
   * It rides along with the Job Application rather than being fetched beside
   * it because every surface that draws one needs them: a silence is read from
   * the last meeting held and the next one standing, and the board reads a
   * silence for every card it draws.
   */
  interviews: z.array(Interview),
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
    closesOn: true,
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

/**
 * Why an extraction answered with no Draft.
 *
 * `ai_usage_spent` and `rate_limited` are two different refusals and not one:
 * the first is the user's month of AI Usage gone, which is an ordinary end to
 * an ordinary allowance, and the second is the daily Model Call ceiling, which
 * a user should never see and which means a runaway client or a leaked
 * Personal Access Token when they do (ADR-0009). A panel that could not tell
 * them apart would have to word both as one, and one of the two wordings would
 * be a lie.
 */
export const ExtractionFailureReason = z.enum([
  "no_job_found",
  "provider_error",
  "rate_limited",
  "ai_usage_spent",
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
  closesOn: null,
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

/**
 * A Status Change: that one Job Application came to stand at a Status, and
 * when — moved there from another, or saved there in the first place.
 *
 * It is the history a Job Application's own `status` column cannot hold, which
 * says only where the user has it today. An employer's answer belongs to the
 * month it arrived in rather than the month the board is read, and this is
 * what says which that was.
 *
 * Append-only, and there is deliberately no shape here for editing one: a
 * Status Change is a record of something that happened at a moment, so a
 * mistaken move and the move back are both in the history (ADR-0010). Nor is
 * there a `createdAt` beside `changedAt` — the two would always be the same
 * instant, because a row is written by the move it describes and never after.
 */
export const StatusChange = z.object({
  id: z.uuid(),
  jobApplicationId: z.uuid(),
  status: JobStatus,
  /**
   * When the Job Application came to stand there. Not the day the user says it
   * happened: `applied_at` is the one date they can correct, and where the two
   * disagree the Activity Report reads `applied` from that and every other
   * Status from here (ADR-0010).
   */
  changedAt: z.iso.datetime(),
});
export type StatusChange = z.infer<typeof StatusChange>;

/**
 * Who said one Message. A closed set like the Statuses and Necessities above,
 * and the database's enum is derived from it rather than retyped.
 *
 * `model` rather than `assistant`: it is the word `CONTEXT.md` uses, and the
 * two roles here are the user and the thing they are talking to. There is no
 * third — a system instruction is assembled for each turn and is never a
 * Message (ADR-0008), so it has no role to be stored under.
 */
export const MessageRole = z.enum(["user", "model"]);
export type MessageRole = z.infer<typeof MessageRole>;

/**
 * A Conversation: the record of the user talking to the model, kept so it can
 * be returned to.
 *
 * `jobApplicationId` is the whole of the routing — null is the general
 * Conversation, and an id is the one attached to that Job Application. There
 * are two kinds and no more, which the database enforces with a pair of unique
 * indexes rather than this comment.
 *
 * Nothing here marks a Conversation stale, deliberately: every turn is
 * assembled from the state of that moment, so a Message is a record of
 * something said rather than a claim still being made (`CONTEXT.md`).
 */
export const Conversation = z.object({
  id: z.uuid(),
  userId: z.string(),
  jobApplicationId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Conversation = z.infer<typeof Conversation>;

/**
 * A Message: one thing said in a Conversation. Prose and nothing else — there
 * is no Draft here and nothing a Message becomes, so it carries text rather
 * than a shape to be read as anything (`CONTEXT.md`).
 */
export const Message = z.object({
  id: z.uuid(),
  conversationId: z.uuid(),
  role: MessageRole,
  text: z.string(),
  /**
   * Whether this is less than what was meant to be said: a reply that broke
   * off partway keeps the prose that arrived and is marked here, so the panel
   * can show the failure against the text rather than beside a Message
   * indistinguishable from a short answer. Always false on the user's own
   * Messages — what a user said arrived whole or did not arrive.
   */
  incomplete: z.boolean(),
  saidAt: z.iso.datetime(),
});
export type Message = z.infer<typeof Message>;
