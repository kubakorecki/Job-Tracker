"use client";

import {
  EXCITEMENT_SCALE,
  groupedByNecessity,
  JobStatus,
  Necessity,
  RemoteType,
  SalaryPeriod,
  UpdateJobApplication,
  type Coverage,
  type JobApplication,
} from "@repo/schema";
import { NECESSITY_LABELS } from "@repo/ui/necessity";
import { REMOTE_TYPE_LABELS } from "@repo/ui/remote-type";
import { SALARY_PERIOD_LABELS } from "@repo/ui/salary-period";
import { JOB_STATUS_LABELS, StatusBadge } from "@repo/ui/status-badge";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type ChangeEvent, type FormEvent } from "react";
import { dayOf } from "../../../../lib/day";
import { describeFailure } from "../../../../lib/api/client";
import { fetchAnalysis, runAnalysis } from "../../../../lib/analysis/client";
import type { AnalysisOrNone } from "../../../../lib/analysis/contract";
import {
  deleteCoverageOverride,
  putCoverageOverride,
} from "../../../../lib/coverage/client";
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
  withReadings,
  type RequirementEdit,
} from "../../../../lib/job-applications/requirement-edits";
import { describeIssues } from "../../../../lib/zod-issues";
import { AnalysisSection } from "./analysis";
import {
  AnalysedReason,
  CoverageBadge,
  CoverageReadings,
  worthNudging,
} from "./coverage-badge";
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
  hasProfileSkills,
  analysis: lastAnalysis,
}: {
  jobApplication: JobApplication;
  /**
   * Whether there is a skill list to compare a Requirement against at all. It
   * comes from the page rather than being guessed from the readings, because
   * an unread Requirement and a user with nothing to read against are two
   * different pieces of news and only one of them is the user's to fix.
   */
  hasProfileSkills: boolean;
  /**
   * The last Analysis of this Job Application, or `null` where none has run.
   * Whether it is stale is the endpoint's answer and travels with it, so the
   * banner, the greyed badges and the API cannot come to three different
   * views of the same run.
   */
  analysis: AnalysisOrNone;
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
  // The run as last read or written: the page starts with what the server
  // rendered, a run replaces it, and a save asks again — because a save is
  // what can make one stale, or stop it being worth saying.
  const [analysis, setAnalysis] = useState<AnalysisOrNone>(lastAnalysis);
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
      await refreshAnalysis();
      // The board reads the one cached list, and this Job Application is in
      // it; the layout's cache is still alive behind this page.
      await queryClient.invalidateQueries({ queryKey: JOB_APPLICATIONS_KEY });
    } catch (error) {
      setProblems(describeFailure(error));
    } finally {
      setSaving(false);
    }
  }

  /**
   * Runs the Analysis, and takes what it answered: the run itself, and every
   * Requirement as it now reads.
   *
   * Only the readings are taken onto the rows. The wording on screen stays the
   * user's, as it does after an override — a run says nothing about what a
   * Posting asks for, and reaching into a box somebody may be typing in would
   * be a model call correcting a person. A row the server has never heard of
   * is left alone entirely: it was no part of what was analysed, and says so
   * by still reading "Not read".
   *
   * It throws whatever the endpoint refused with, which the control that asked
   * for it puts in front of the user in the endpoint's own words.
   */
  async function onAnalyse(): Promise<void> {
    const result = await runAnalysis(saved.id);
    const answered = new Map(result.requirements.map((one) => [one.id, one]));

    setAnalysis(result.analysis);
    setRequirements((current) =>
      current.map((row) => {
        const read = row.id === null ? undefined : answered.get(row.id);
        return read === undefined ? row : withReadings(row, read);
      }),
    );
    setSaved((current) => ({ ...current, requirements: result.requirements }));
    // The board's cached list carries these Requirements, and a run has just
    // changed what several of them read — including what issue 15's fit ring
    // draws from.
    await queryClient.invalidateQueries({ queryKey: JOB_APPLICATIONS_KEY });
  }

  /**
   * The Analysis as the endpoint now reads it, asked for after a save because
   * a save is what moves it: editing the Requirements is one of the two things
   * that can leave a run describing something that is no longer there, and
   * moving the Status past Applied is what stops that being worth saying at
   * all. Both rules are the endpoint's (`analysis/staleness.ts`) and neither
   * is worked out again here.
   *
   * A save that changed nothing an Analysis reads still asks; one request that
   * spends nothing is cheaper than a rule about which fields matter, kept in
   * step with the one on the server.
   *
   * Failing to re-read is not failing to save. The banner is left saying what
   * it said and the next page load settles it — reporting it as a problem
   * under a form that has just saved would blame the save for it.
   */
  async function refreshAnalysis(): Promise<void> {
    if (analysis === null) return;

    try {
      setAnalysis(await fetchAnalysis(saved.id));
    } catch {
      // Left as it was; see above.
    }
  }

  /**
   * The user's own word about one Requirement, said or taken back. It saves
   * as it is set rather than waiting for the page's button: it is a decision
   * about a verdict rather than a correction to what the Posting asked for,
   * and the endpoint that takes it addresses the one Requirement.
   *
   * Both copies of the Requirement move with it — the row being edited, so the
   * badge answers, and the last-persisted Job Application, so the next save is
   * still measured against what the server holds. It throws on a refusal,
   * which the row that asked for it reports next to the control.
   */
  async function onOverride(
    requirement: RequirementEdit,
    coverage: Coverage | null,
  ): Promise<void> {
    // A Requirement the server has never heard of has nothing to override; the
    // control is not offered for one, and this is the other half of that.
    if (requirement.id === null) return;

    const overridden =
      coverage === null
        ? await deleteCoverageOverride(saved.id, requirement.id)
        : await putCoverageOverride(saved.id, requirement.id, coverage);

    setRequirements((current) =>
      current.map((row) =>
        row.key === requirement.key ? withReadings(row, overridden) : row,
      ),
    );
    setSaved((current) => ({
      ...current,
      requirements: current.requirements.map((one) =>
        one.id === overridden.id ? overridden : one,
      ),
    }));
    // The board's cached list carries these Requirements and is still alive
    // behind this page, so it would otherwise go on showing the verdict the
    // user has just overruled — and it is what issue 15's fit ring will draw.
    await queryClient.invalidateQueries({ queryKey: JOB_APPLICATIONS_KEY });
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
          <Field label="Per">
            <select
              className={FIELD}
              onChange={edit("salaryPeriod")}
              value={edits.salaryPeriod}
            >
              <option value="">Not recorded</option>
              {SalaryPeriod.options.map((period) => (
                <option key={period} value={period}>
                  {SALARY_PERIOD_LABELS[period]}
                </option>
              ))}
            </select>
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

        {/* Only where there is something to analyse. A Job Application that
            records no Requirements has nothing to ask the model about — the
            endpoint refuses it without spending anything — and a control that
            could only fail is not one to offer. Whether there is a CV to read
            is deliberately not asked here: the answer is the Profile's prose,
            which this page does not hold, and the endpoint says so plainly. */}
        {saved.requirements.length > 0 && (
          <AnalysisSection
            analysis={analysis}
            onRun={onAnalyse}
            unsaved={
              requirementChanges(requirements, saved).requirements !== undefined
            }
          />
        )}

        <Requirements
          hasProfileSkills={hasProfileSkills}
          onChange={(next) => {
            setNotice(null);
            setRequirements(next);
          }}
          onOverride={onOverride}
          requirements={requirements}
          stale={analysis?.stale === true}
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
  hasProfileSkills,
  stale,
  onChange,
  onOverride,
}: {
  requirements: RequirementEdit[];
  hasProfileSkills: boolean;
  /**
   * Whether the Analysis that spoke about these has gone out of date. It is
   * carried down rather than worked out on the way, because it is one fact
   * about the run and every row of it is greyed or not together.
   */
  stale: boolean;
  onChange: (requirements: RequirementEdit[]) => void;
  onOverride: (
    requirement: RequirementEdit,
    coverage: Coverage | null,
  ) => Promise<void>;
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

      {groups.length > 0 && !hasProfileSkills && (
        <p className="text-sm opacity-60">
          Nothing is being compared yet.{" "}
          <Link
            className="underline underline-offset-2"
            href="/settings/profile"
          >
            Upload your CV and accept its skills
          </Link>{" "}
          and every Requirement here will say whether you have it.
        </p>
      )}

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
                <RequirementRow
                  hasProfileSkills={hasProfileSkills}
                  key={requirement.key}
                  onCorrect={(correction) =>
                    correct(requirement.key, correction)
                  }
                  onOverride={(coverage) => onOverride(requirement, coverage)}
                  onRemove={() => remove(requirement.key)}
                  requirement={requirement}
                  stale={stale}
                />
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
 * One Requirement, correctable: its wording, how badly it is wanted, how the
 * user's CV reads against it, what the model made of it, the user's own word
 * about that, and the way out of the list.
 *
 * The Analysis's line stands under the row rather than inside the disclosure,
 * because it is the answer to "what do I change?" and one the user spent a
 * model call on; the three verdicts behind the badge are still a click away.
 *
 * The readings go under the row rather than beside the badge, across its whole
 * width. Opening them there pushes the next row down instead of widening a
 * column, so the rows above and below keep their controls in line with this
 * one's — and the three readings have room to be a list rather than a squeeze.
 *
 * The override is the one thing here that saves on its own, so it is the one
 * thing here with its own pending state and its own place to report a refusal:
 * the page's problem list sits below every Requirement, and a failure to
 * record a verdict belongs against the verdict.
 */
function RequirementRow({
  requirement,
  hasProfileSkills,
  stale,
  onCorrect,
  onOverride,
  onRemove,
}: {
  requirement: RequirementEdit;
  hasProfileSkills: boolean;
  /** Whether what the Analysis said about this one still describes anything. */
  stale: boolean;
  onCorrect: (correction: Partial<Omit<RequirementEdit, "key">>) => void;
  onOverride: (coverage: Coverage | null) => Promise<void>;
  onRemove: () => void;
}) {
  const [showingReadings, setShowingReadings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  // Offered once, on the change that earns it, rather than standing under
  // every claimed skill for as long as the CV is out of date: it is advice
  // about what the user has just done, and a page of permanent reproaches
  // would be read as decoration within a day.
  const [nudging, setNudging] = useState(false);
  const readings = useId();

  async function override(coverage: Coverage | null) {
    setSaving(true);
    setProblems([]);
    try {
      await onOverride(coverage);
      setNudging(worthNudging(requirement, coverage, hasProfileSkills));
    } catch (error) {
      setProblems(describeFailure(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Skill"
          className={`${FIELD} min-w-0 flex-1`}
          onChange={(event) => onCorrect({ skill: event.target.value })}
          value={requirement.skill}
        />
        {/* The select fills what it is given, so its width is the row's
            business rather than its own. */}
        <div className="w-40 shrink-0">
          <NecessitySelect
            label={`Necessity of ${requirement.skill}`}
            onChange={(wanted) => onCorrect({ necessity: wanted })}
            value={requirement.necessity}
          />
        </div>
        <CoverageBadge
          onToggle={() => setShowingReadings((shown) => !shown)}
          readingsId={readings}
          requirement={requirement}
          showing={showingReadings}
          stale={stale}
        />
        <button
          aria-label={`Remove ${requirement.skill}`}
          className="text-sm underline underline-offset-2 opacity-60"
          onClick={onRemove}
          type="button"
        >
          Remove
        </button>
      </div>

      {requirement.analysedReason !== null && (
        <AnalysedReason reason={requirement.analysedReason} stale={stale} />
      )}

      {showingReadings && (
        <CoverageReadings
          id={readings}
          override={{
            nudging,
            onSet: requirement.id === null ? undefined : override,
            problems,
            saving,
          }}
          requirement={requirement}
          stale={stale}
        />
      )}
    </li>
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
