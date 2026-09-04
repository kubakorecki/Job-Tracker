"use client";

import {
  EXCITEMENT_SCALE,
  JobStatus,
  RemoteType,
  UpdateJobApplication,
  type JobApplication,
} from "@repo/schema";
import { REMOTE_TYPE_LABELS } from "@repo/ui/remote-type";
import { JOB_STATUS_LABELS, StatusBadge } from "@repo/ui/status-badge";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { dayOf } from "../../../../lib/day";
import { describeFailure } from "../../../../lib/api/client";
import {
  deleteJobApplication,
  patchJobApplication,
} from "../../../../lib/job-applications/client";
import {
  changesFrom,
  editsFrom,
  type JobApplicationEdits,
} from "../../../../lib/job-applications/edits";
import { describeIssues } from "../../../../lib/zod-issues";
import { FIELD, Field, PRIMARY_BUTTON, Problems, Row } from "../../../form";
import { JOB_APPLICATIONS_KEY } from "../../use-job-applications";

/**
 * One Job Application, whole and editable. Every field the contract carries
 * has a box here — this is the only place a Job Application can be corrected
 * once it has been recorded, whether the extension proposed it or the user
 * typed it in.
 *
 * The form holds text and only text (`JobApplicationEdits`); what turns that
 * back into a patch, and decides which fields the patch should name at all,
 * is `changesFrom`, which is tested on its own.
 */
export function JobApplicationDetail({
  jobApplication,
}: {
  jobApplication: JobApplication;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  // The Job Application as last persisted. Every save replaces it, so the next
  // save is measured against what the server actually holds.
  const [saved, setSaved] = useState(jobApplication);
  const [edits, setEdits] = useState<JobApplicationEdits>(() =>
    editsFrom(jobApplication),
  );
  const [problems, setProblems] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const edit =
    (field: keyof JobApplicationEdits) =>
    (
      event: ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      const { value } = event.target;
      setNotice(null);
      setEdits((current) => ({ ...current, [field]: value }));
    };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const changes = UpdateJobApplication.safeParse(changesFrom(edits, saved));
    if (!changes.success) {
      setNotice(null);
      setProblems(describeIssues(changes.error));
      return;
    }

    if (Object.keys(changes.data).length === 0) {
      setProblems([]);
      setNotice("Nothing has changed.");
      return;
    }

    setProblems([]);
    setNotice(null);
    setSaving(true);

    try {
      const updated = await patchJobApplication(saved.id, changes.data);
      setSaved(updated);
      // Back from the fields the server settled — a trimmed company, an
      // applied date stamped by a move to Applied.
      setEdits(editsFrom(updated));
      setNotice("Saved.");
      // The board reads the one cached list, and this Job Application is in
      // it; the layout's cache is still alive behind this page.
      await queryClient.invalidateQueries({ queryKey: JOB_APPLICATIONS_KEY });
    } catch (error) {
      setProblems(describeFailure(error));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    setProblems([]);
    setDeleting(true);

    try {
      await deleteJobApplication(saved.id);
      // Take it out of the board's list before going back to the board, or it
      // would be there to see for as long as the refetch takes.
      await queryClient.invalidateQueries({ queryKey: JOB_APPLICATIONS_KEY });
      router.push("/dashboard");
    } catch (error) {
      setProblems(describeFailure(error));
      setConfirmingDelete(false);
      setDeleting(false);
    }
  }

  return (
    <>
      <header className="flex flex-col gap-2">
        <Link
          className="text-sm underline underline-offset-2 opacity-60"
          href="/dashboard"
        >
          ← Back to the board
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{saved.company}</h1>
            <p className="text-sm opacity-60">{saved.jobTitle}</p>
          </div>
          <StatusBadge status={saved.status} />
        </div>
        <p className="text-xs opacity-50">
          Added on {dayOf(saved.createdAt)} · last changed{" "}
          {dayOf(saved.updatedAt)}
        </p>
      </header>

      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <Row>
          <Field label="Company">
            <input
              className={FIELD}
              onChange={edit("company")}
              value={edits.company}
            />
          </Field>
          <Field label="Job title">
            <input
              className={FIELD}
              onChange={edit("jobTitle")}
              value={edits.jobTitle}
            />
          </Field>
        </Row>

        <Row>
          <Field label="Posting URL">
            <input
              className={FIELD}
              onChange={edit("jobUrl")}
              placeholder="No Posting"
              value={edits.jobUrl}
            />
          </Field>
          <Field label="Source">
            <input
              className={FIELD}
              onChange={edit("source")}
              placeholder="Referral, LinkedIn, recruiter email…"
              value={edits.source}
            />
          </Field>
        </Row>

        <Row>
          <Field label="Status">
            <select
              className={FIELD}
              onChange={edit("status")}
              value={edits.status}
            >
              {JobStatus.options.map((status) => (
                <option key={status} value={status}>
                  {JOB_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Applied on">
            <input
              className={FIELD}
              onChange={edit("appliedAt")}
              type="date"
              value={edits.appliedAt}
            />
          </Field>
        </Row>

        <Row>
          <Field label="Location">
            <input
              className={FIELD}
              onChange={edit("location")}
              value={edits.location}
            />
          </Field>
          <Field label="Remote type">
            <select
              className={FIELD}
              onChange={edit("remoteType")}
              value={edits.remoteType}
            >
              <option value="">Not recorded</option>
              {RemoteType.options.map((remoteType) => (
                <option key={remoteType} value={remoteType}>
                  {REMOTE_TYPE_LABELS[remoteType]}
                </option>
              ))}
            </select>
          </Field>
        </Row>

        <Row>
          <Field label="Salary from">
            <input
              className={FIELD}
              onChange={edit("salaryMin")}
              type="number"
              value={edits.salaryMin}
            />
          </Field>
          <Field label="Salary to">
            <input
              className={FIELD}
              onChange={edit("salaryMax")}
              type="number"
              value={edits.salaryMax}
            />
          </Field>
          <Field label="Currency">
            <input
              className={FIELD}
              onChange={edit("currency")}
              placeholder="GBP"
              value={edits.currency}
            />
          </Field>
        </Row>

        <Excitement
          onChange={(excitement) => {
            setNotice(null);
            setEdits((current) => ({ ...current, excitement }));
          }}
          value={edits.excitement}
        />

        <Field label="Description">
          <textarea
            className={FIELD}
            onChange={edit("description")}
            rows={5}
            value={edits.description}
          />
        </Field>

        <Field label="Notes">
          <textarea
            className={FIELD}
            onChange={edit("notes")}
            placeholder="What you want to remember about this one."
            rows={4}
            value={edits.notes}
          />
        </Field>

        <Problems problems={problems} />

        <div className="flex items-center gap-3">
          <button className={PRIMARY_BUTTON} disabled={saving} type="submit">
            {saving ? "Saving…" : "Save changes"}
          </button>
          {notice !== null && (
            <span aria-live="polite" className="text-sm opacity-60">
              {notice}
            </span>
          )}
        </div>
      </form>

      <DeleteJobApplication
        company={saved.company}
        confirming={confirmingDelete}
        deleting={deleting}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={onDelete}
        onStart={() => setConfirmingDelete(true)}
      />
    </>
  );
}

/**
 * Removing a Job Application, behind a question. Deleting is the one thing
 * here that cannot be undone by editing the field back, so the button that
 * does it is never the button the user reaches for first.
 */
function DeleteJobApplication({
  company,
  confirming,
  deleting,
  onStart,
  onConfirm,
  onCancel,
}: {
  company: string;
  confirming: boolean;
  deleting: boolean;
  onStart: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>Delete {company}? This cannot be undone.</span>
          <button
            className="rounded-md bg-red-600 px-3 py-1.5 font-medium text-white disabled:opacity-50"
            disabled={deleting}
            onClick={onConfirm}
            type="button"
          >
            {deleting ? "Deleting…" : "Yes, delete it"}
          </button>
          <button
            className="underline underline-offset-2 opacity-60"
            disabled={deleting}
            onClick={onCancel}
            type="button"
          >
            Keep it
          </button>
        </div>
      ) : (
        <button
          className="text-sm text-red-600 underline underline-offset-2 dark:text-red-400"
          onClick={onStart}
          type="button"
        >
          Delete this Job Application
        </button>
      )}
    </section>
  );
}

/**
 * How much the user wants this one, one to five. A row of radios rather than a
 * select, because a scale is a thing you point at rather than a list you pick
 * from — and it can be put back to nothing at all, which is where every Job
 * Application starts.
 */
function Excitement({
  value,
  onChange,
}: {
  value: string;
  onChange: (excitement: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm opacity-60">Excitement</legend>
      <div className="flex items-center gap-2">
        {EXCITEMENT_SCALE.map((step) => {
          const chosen = value === String(step);
          return (
            <label
              className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm focus-within:ring-2 focus-within:ring-blue-500 ${
                chosen
                  ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                  : "border-neutral-300 dark:border-neutral-700"
              }`}
              key={step}
            >
              <input
                checked={chosen}
                className="sr-only"
                name="excitement"
                onChange={() => onChange(String(step))}
                type="radio"
                value={step}
              />
              {step}
            </label>
          );
        })}
        {value !== "" && (
          <button
            className="text-sm underline underline-offset-2 opacity-60"
            onClick={() => onChange("")}
            type="button"
          >
            Clear
          </button>
        )}
      </div>
    </fieldset>
  );
}
