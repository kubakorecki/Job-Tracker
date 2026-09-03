import type {
  JobApplication,
  JobStatus,
  RemoteType,
  UpdateJobApplication,
} from "@repo/schema";
import { appliedAtFromDateInput, appliedDateInput } from "./applied-date";

/**
 * The detail view's arithmetic, kept apart from the form that renders it: a
 * Job Application as text a form can hold, and the patch that text amounts to.
 *
 * The patch names only what the user actually changed. Sending every field
 * back would work — the endpoint takes a full patch happily enough — but it
 * would also overwrite whatever the extension or another tab had written to a
 * field this user never looked at, and would rewrite the applied date's time
 * of day every time the form was saved untouched.
 */

/** Every editable field of a Job Application, as the form holds it: text. */
export type JobApplicationEdits = Record<keyof UpdateJobApplication, string>;

/**
 * Each field's way back from text to the shape the contract states it in. The
 * type demands one per editable field, so a field added to the contract stops
 * the build here rather than quietly becoming uneditable.
 *
 * The two closed sets — Status and remote type — are asserted rather than
 * parsed here. The controls that produce them are built from the contract's
 * own options, and the assembled patch is parsed against the contract before
 * it is sent, so a value from anywhere else is refused there with a line
 * naming the field.
 */
type ToStored = {
  [K in keyof UpdateJobApplication]-?: (
    text: string,
  ) => UpdateJobApplication[K];
};

const trimmed = (text: string) => text.trim();
const orNull = (text: string) => (text.trim() === "" ? null : text.trim());
const numberOrNull = (text: string) =>
  text.trim() === "" ? null : Number(text);

const TO_STORED: ToStored = {
  company: trimmed,
  jobTitle: trimmed,
  jobUrl: orNull,
  location: orNull,
  remoteType: (text) => (text === "" ? null : (text as RemoteType)),
  salaryMin: numberOrNull,
  salaryMax: numberOrNull,
  currency: orNull,
  description: orNull,
  keywords: (text) =>
    text
      .split(",")
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword !== ""),
  status: (text) => text as JobStatus,
  source: orNull,
  appliedAt: (text) => appliedAtFromDateInput(text.trim()),
  excitement: numberOrNull,
  notes: orNull,
};

const EDITABLE_FIELDS = Object.keys(TO_STORED) as (keyof JobApplicationEdits)[];

/** A Job Application as a form's worth of text. Nothing unset reads as "null". */
export function editsFrom(jobApplication: JobApplication): JobApplicationEdits {
  const number = (value: number | null) =>
    value === null ? "" : String(value);

  return {
    company: jobApplication.company,
    jobTitle: jobApplication.jobTitle,
    jobUrl: jobApplication.jobUrl ?? "",
    location: jobApplication.location ?? "",
    remoteType: jobApplication.remoteType ?? "",
    salaryMin: number(jobApplication.salaryMin),
    salaryMax: number(jobApplication.salaryMax),
    currency: jobApplication.currency ?? "",
    description: jobApplication.description ?? "",
    keywords: jobApplication.keywords.join(", "),
    status: jobApplication.status,
    source: jobApplication.source ?? "",
    appliedAt: appliedDateInput(jobApplication.appliedAt),
    excitement: number(jobApplication.excitement),
    notes: jobApplication.notes ?? "",
  };
}

/**
 * What the user changed, as a patch. The comparison is between two forms
 * rather than between a form and a stored row: a date box holds a day where
 * the row holds an instant, so comparing the text is the only way to tell an
 * untouched date from one the user moved to midnight.
 *
 * A change the contract will refuse — an emptied company — is kept, so that
 * `UpdateJobApplication` gets to name the problem rather than this silently
 * dropping it.
 */
export function changesFrom(
  edits: JobApplicationEdits,
  saved: JobApplication,
): UpdateJobApplication {
  const before = editsFrom(saved);
  const changes: UpdateJobApplication = {};

  for (const field of EDITABLE_FIELDS) {
    if (edits[field].trim() === before[field].trim()) continue;

    // Each converter returns its own field's stored type; indexing loses which
    // one, and the caller parses the assembled patch against the contract.
    (changes as Record<string, unknown>)[field] = TO_STORED[field](
      edits[field],
    );
  }

  return changes;
}
