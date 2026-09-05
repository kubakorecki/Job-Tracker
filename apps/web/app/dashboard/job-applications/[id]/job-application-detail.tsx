"use client";

import {
  EXCITEMENT_SCALE,
  groupedByNecessity,
  JobStatus,
  Necessity,
  RemoteType,
  UpdateJobApplication,
  type JobApplication,
} from "@repo/schema";
import { NECESSITY_LABELS } from "@repo/ui/necessity";
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
import {
  newRequirementEdit,
  requirementChanges,
  requirementEditsFrom,
  type RequirementEdit,
} from "../../../../lib/job-applications/requirement-edits";
import { describeIssues } from "../../../../lib/zod-issues";
import {
  FIELD,
  Field,
  PRIMARY_BUTTON,
  Problems,
  Row,
  SECONDARY_BUTTON,
} from "../../../form";
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
  // The Requirements are held apart from the text fields because they are a
  // list rather than a box: added to, removed from, and regrouped as a
  // Necessity changes. They save with everything else, on the one button.
  const [requirements, setRequirements] = useState<RequirementEdit[]>(() =>
    requirementEditsFrom(jobApplication.requirements),
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

    const changes = UpdateJobApplication.safeParse({
      ...changesFrom(edits, saved),
      ...requirementChanges(requirements, saved),
    });
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
      setRequirements(requirementEditsFrom(updated.requirements));
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

        <Requirements
          onChange={(next) => {
            setNotice(null);
            setRequirements(next);
          }}
          requirements={requirements}
        />

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
 * What this job asks of a candidate, under how badly it asks for it. Every
 * Requirement here can be corrected or taken away and a new one typed in,
 * whether the extraction read them off a Posting or there is no Posting at
 * all and the user is recording what a recruiter's email said.
 *
 * The list is flat underneath and grouped only to be read: a Requirement keeps
 * the place it was captured in, so changing how badly it is wanted moves it
 * between headings without disturbing the order of anything else.
 *
 * Nothing saves until the page does. Corrections to what a job asks for belong
 * with corrections to its title and its salary, on the one button.
 */
function Requirements({
  requirements,
  onChange,
}: {
  requirements: RequirementEdit[];
  onChange: (requirements: RequirementEdit[]) => void;
}) {
  const [skill, setSkill] = useState("");
  const [necessity, setNecessity] = useState<Necessity>("required");

  const groups = groupedByNecessity(requirements);
  const typed = skill.trim();

  function add() {
    if (typed === "") return;
    onChange([
      ...requirements,
      newRequirementEdit({ skill: typed, necessity }),
    ]);
    setSkill("");
  }

  function correct(
    key: string,
    correction: Partial<Omit<RequirementEdit, "key">>,
  ) {
    onChange(
      requirements.map((requirement) =>
        requirement.key === key
          ? { ...requirement, ...correction }
          : requirement,
      ),
    );
  }

  function remove(key: string) {
    onChange(requirements.filter((requirement) => requirement.key !== key));
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm opacity-60">Requirements</legend>

      {groups.length === 0 ? (
        <p className="text-sm opacity-60">
          Nothing is recorded as asked for yet.
        </p>
      ) : (
        groups.map(({ necessity: asked, requirements: group }) => (
          <div className="flex flex-col gap-2" key={asked}>
            <h3 className="text-xs font-medium uppercase opacity-50">
              {NECESSITY_LABELS[asked]}
            </h3>
            <ul className="flex flex-col gap-2">
              {group.map((requirement) => (
                <li
                  className="flex flex-wrap items-center gap-2"
                  key={requirement.key}
                >
                  <input
                    aria-label="Skill"
                    className={`${FIELD} min-w-0 flex-1`}
                    onChange={(event) =>
                      correct(requirement.key, { skill: event.target.value })
                    }
                    value={requirement.skill}
                  />
                  {/* The select fills what it is given, so its width is the
                      row's business rather than its own. */}
                  <div className="w-40 shrink-0">
                    <NecessitySelect
                      label={`Necessity of ${requirement.skill}`}
                      onChange={(wanted) =>
                        correct(requirement.key, { necessity: wanted })
                      }
                      value={requirement.necessity}
                    />
                  </div>
                  <button
                    aria-label={`Remove ${requirement.skill}`}
                    className="text-sm underline underline-offset-2 opacity-60"
                    onClick={() => remove(requirement.key)}
                    type="button"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field label="Add a Requirement">
          <input
            className={FIELD}
            onChange={(event) => setSkill(event.target.value)}
            // Enter in a box inside a form saves the form, which here would
            // save the page and leave the typed skill behind in the box.
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              add();
            }}
            placeholder="What this job asks for"
            value={skill}
          />
        </Field>
        <Field label="Necessity">
          <NecessitySelect onChange={setNecessity} value={necessity} />
        </Field>
        <button
          className={SECONDARY_BUTTON}
          disabled={typed === ""}
          onClick={add}
          type="button"
        >
          Add
        </button>
      </div>
    </fieldset>
  );
}

/**
 * The three Necessities, offered as the contract lists them. The value is
 * asserted rather than parsed for the same reason the Status select's is: the
 * options are built from the contract's own set, and the assembled patch is
 * parsed against the contract before it is sent.
 *
 * The label is a prop rather than a wrapping `Field` because a group's rows
 * have their heading above the whole list, and a visible label on each select
 * would repeat "Necessity" down the page. It names the Requirement it belongs
 * to, so that hearing the page read out tells one row's select from the next.
 */
function NecessitySelect({
  value,
  onChange,
  label,
}: {
  value: Necessity;
  onChange: (necessity: Necessity) => void;
  label?: string;
}) {
  return (
    <select
      aria-label={label}
      className={FIELD}
      onChange={(event) => onChange(event.target.value as Necessity)}
      value={value}
    >
      {Necessity.options.map((option) => (
        <option key={option} value={option}>
          {NECESSITY_LABELS[option]}
        </option>
      ))}
    </select>
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
