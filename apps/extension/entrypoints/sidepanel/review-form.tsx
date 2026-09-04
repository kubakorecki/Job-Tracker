import {
  JobStatus,
  nearDuplicatesOf,
  RemoteType,
  type CreateJobApplication,
  type JobApplication,
} from "@repo/schema";
import { REMOTE_TYPE_LABELS } from "@repo/ui/remote-type";
import { JOB_STATUS_LABELS } from "@repo/ui/status-badge";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  createFrom,
  type DraftFields,
  type DraftTextFields,
} from "../../lib/draft";
import { Problems } from "./problems";

/**
 * The Draft, in front of the user, editable. It is the only thing standing
 * between an extraction and a stored record: the model is right about most of
 * a Posting and wrong about some of it, and which some is the user's to say.
 *
 * The same form is manual entry. A referral typed in by hand and a Draft
 * corrected by hand produce the same write, so there is one form rather than
 * two that would have to be kept in step.
 */
export function ReviewForm({
  initial,
  explanation,
  existing,
  onSave,
  onCancel,
}: {
  initial: DraftFields;
  /** Why the boxes are empty, when they are. Absent after a good extraction. */
  explanation: string | null;
  /** What the user has saved already, for the near-duplicate hint. */
  existing: JobApplication[];
  /** Saves, and answers with whatever stopped it. Empty means it saved. */
  onSave: (input: CreateJobApplication) => Promise<string[]>;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState(initial);
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // The same role advertised in two places is two Postings and stays two Job
  // Applications; merging them automatically would be a false merge at every
  // company that posts twenty near-identical roles, and a wrong merge silently
  // destroys a record (ADR-0002). So this is said and nothing else: it is
  // recomputed as the user types, it stops nothing, and Save is the same
  // button it was.
  const hint = nearDuplicateHint(nearDuplicatesOf(fields, existing));

  const set = (field: keyof DraftTextFields) => (value: string) =>
    setFields((current) => ({ ...current, [field]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    // Checked against the shared contract before anything is sent, so the
    // ordinary mistake — a Posting that never named its employer — is answered
    // without a round trip. This is the only place the boxes become a Job
    // Application; what goes up is the value, not the text it came from. The
    // endpoint checks it again with the same schema, because a client is not a
    // gate.
    const read = createFrom(fields);
    if ("problems" in read) {
      setProblems(read.problems);
      return;
    }

    setProblems([]);
    setSaving(true);
    try {
      setProblems(await onSave(read.input));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <h2>Review</h2>

      {explanation !== null && (
        <p className="explanation" role="status">
          {explanation}
        </p>
      )}

      {hint !== null && (
        <p className="explanation" role="status">
          {hint}
        </p>
      )}

      <form onSubmit={submit}>
        <Field label="Company">
          <input onChange={changes(set("company"))} value={fields.company} />
        </Field>

        <Field label="Job title">
          <input onChange={changes(set("jobTitle"))} value={fields.jobTitle} />
        </Field>

        <Field label="Posting URL">
          <input
            onChange={changes(set("jobUrl"))}
            spellCheck={false}
            value={fields.jobUrl}
          />
        </Field>

        <Field label="Location">
          <input onChange={changes(set("location"))} value={fields.location} />
        </Field>

        <div className="row">
          <Field label="Working pattern">
            <select
              onChange={changes(set("remoteType"))}
              value={fields.remoteType}
            >
              <option value="">Not stated</option>
              {RemoteType.options.map((remoteType) => (
                <option key={remoteType} value={remoteType}>
                  {REMOTE_TYPE_LABELS[remoteType]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Status">
            <select onChange={changes(set("status"))} value={fields.status}>
              {JobStatus.options.map((status) => (
                <option key={status} value={status}>
                  {JOB_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="row">
          <Field label="Salary from">
            <input
              inputMode="numeric"
              onChange={changes(set("salaryMin"))}
              value={fields.salaryMin}
            />
          </Field>

          <Field label="Salary to">
            <input
              inputMode="numeric"
              onChange={changes(set("salaryMax"))}
              value={fields.salaryMax}
            />
          </Field>

          <Field label="Currency">
            <input
              onChange={changes(set("currency"))}
              value={fields.currency}
            />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            onChange={changes(set("description"))}
            rows={5}
            value={fields.description}
          />
        </Field>

        <Problems problems={problems} />

        <div className="actions">
          <button className="button" disabled={saving} type="submit">
            {saving ? "Saving…" : "Save"}
          </button>
          <button className="link" onClick={onCancel} type="button">
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

/**
 * The hint itself, or nothing to say. It names the one Job Application where
 * there is one, because a title the user can read is what tells them whether
 * this really is the same role — and only counts them where there are several,
 * since a list of five would be a screen of its own in a panel this wide.
 */
function nearDuplicateHint(alreadyHave: JobApplication[]): string | null {
  const [first] = alreadyHave;
  if (first === undefined) return null;

  const what =
    alreadyHave.length === 1
      ? `a Job Application at ${first.company} with a similar title — ${first.jobTitle}`
      : `${alreadyHave.length} Job Applications at ${first.company} with similar titles`;

  return `You already have ${what}. Save anyway if this is a different role.`;
}

/** One labelled box. The label is the element, so the whole line is a target. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

/** The value out of a change, for controls that differ only in their tag. */
function changes(set: (value: string) => void) {
  return (event: { target: { value: string } }) => set(event.target.value);
}
