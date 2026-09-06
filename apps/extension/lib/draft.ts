import {
  CreateJobApplication,
  type JobExtraction,
  type JobStatus,
  type Requirement,
} from "@repo/schema";

/**
 * The review form's arithmetic, kept apart from the form that renders it: a
 * Draft as text a form can hold, and the Job Application that text amounts to.
 * It is the same split the dashboard's detail view makes (`edits.ts` in the
 * web app), and for the same reason — a form holds strings, the contract does
 * not, and the conversion is worth reading on its own.
 *
 * A Draft is never persisted (`CONTEXT.md`). What leaves here is a
 * `CreateJobApplication` for the same endpoint the dashboard posts to, so the
 * extension has no write path of its own to keep in step.
 */

/** The fields the review form holds in a box, as it holds them: text. */
export type DraftTextFields = {
  company: string;
  jobTitle: string;
  jobUrl: string;
  location: string;
  remoteType: string;
  salaryMin: string;
  salaryMax: string;
  salaryPeriod: string;
  currency: string;
  description: string;
  status: string;
};

/**
 * Everything the review form carries. All text but the Requirements, which
 * each carry a Necessity and so cannot be a box of comma-separated words. They
 * ride through the panel as they were extracted; correcting them belongs on
 * the dashboard, beside the Coverage that makes a correction worth making.
 */
export type DraftFields = DraftTextFields & { requirements: Requirement[] };

/** What a Job Application the user has not touched yet starts as. */
const STARTING_STATUS: JobStatus = "bookmarked";

/**
 * A Draft as a form's worth of text, with the Posting's own URL alongside it.
 * The URL comes from the tab rather than from the Draft: the model is asked
 * what the page says, and where the page is is something the panel already
 * knows for certain.
 *
 * Nothing the extraction left out reads as "undefined" — an unfilled box is
 * how a Draft says the page did not state a field.
 */
export function fieldsFrom(
  draft: JobExtraction,
  url: string | null,
): DraftFields {
  // The Draft's fields are the Job Application's, made optional — so each one
  // can be absent (the model was not asked), null (a stored row says so), or a
  // value, and an empty box says the first two the same way.
  const number = (value: number | null | undefined) =>
    value == null ? "" : String(value);

  return {
    company: draft.company ?? "",
    jobTitle: draft.jobTitle ?? "",
    jobUrl: url ?? "",
    location: draft.location ?? "",
    remoteType: draft.remoteType ?? "",
    salaryMin: number(draft.salaryMin),
    salaryMax: number(draft.salaryMax),
    salaryPeriod: draft.salaryPeriod ?? "",
    currency: draft.currency ?? "",
    description: draft.description ?? "",
    requirements: draft.requirements ?? [],
    status: STARTING_STATUS,
  };
}

/**
 * An empty form. Manual entry opens one of these deliberately blank — a user
 * recording a referral is not on the Posting, and a URL borrowed from whatever
 * tab happened to be in front would attach the wrong Posting to the record.
 */
export function emptyFields(): DraftFields {
  return fieldsFrom({}, null);
}

/**
 * What the form amounts to, or the reasons it does not amount to anything. The
 * shape follows `jsonBody` in the web app: a caller tests for the failure
 * member and is left holding the value otherwise.
 *
 * It is the shared contract that decides, not a list of rules restated here,
 * so the panel refuses exactly what the endpoint would have refused — and the
 * endpoint still validates, because a client is not a gate.
 */
export function createFrom(
  fields: DraftFields,
): { input: CreateJobApplication } | { problems: string[] } {
  const text = (value: string) => value.trim();
  const optional = (value: string) =>
    value.trim() === "" ? undefined : value.trim();
  const number = (value: string) =>
    value.trim() === "" ? undefined : Number(value);

  // Every optional field is sent as `undefined` rather than omitted: the
  // contract gives each one a create-time default, and a default is what an
  // absent field takes whether it was left out or handed over empty.
  const parsed = CreateJobApplication.safeParse({
    company: text(fields.company),
    jobTitle: text(fields.jobTitle),
    jobUrl: optional(fields.jobUrl),
    location: optional(fields.location),
    remoteType: optional(fields.remoteType),
    salaryMin: number(fields.salaryMin),
    salaryMax: number(fields.salaryMax),
    salaryPeriod: optional(fields.salaryPeriod),
    currency: optional(fields.currency),
    description: optional(fields.description),
    requirements:
      fields.requirements.length === 0 ? undefined : fields.requirements,
    status: fields.status,
  });

  return parsed.success
    ? { input: parsed.data }
    : { problems: describeIssues(parsed.error) };
}

/**
 * A failed parse as one line per offending field, the way the dashboard writes
 * one (`describeIssues` in the web app). The error is read structurally rather
 * than imported as a Zod type: the panel has no other use for Zod's types, and
 * this is the only shape of it the panel ever sees.
 */
function describeIssues(error: {
  issues: readonly { path: readonly PropertyKey[]; message: string }[];
}): string[] {
  return error.issues.map((issue) =>
    issue.path.length === 0
      ? issue.message
      : `${issue.path.join(".")}: ${issue.message}`,
  );
}
