"use client";

import {
  CreateInterview,
  UpdateInterview,
  type Interview,
  type JobApplication,
} from "@repo/schema";
import { JOB_STATUS_LABELS } from "@repo/ui/status-badge";
import { useState } from "react";
import { describeFailure } from "../../../../lib/api/client";
import { dayOf, todayInUtc } from "../../../../lib/day";
import {
  deleteInterview,
  patchInterview,
  postInterview,
} from "../../../../lib/interviews/client";
import {
  arrangedFrom,
  blankInterviewEdits,
  interviewChangesFrom,
  interviewEditsFrom,
  type InterviewEdits,
} from "../../../../lib/interviews/edits";
import { inTheOrderHeld } from "../../../../lib/interviews/reading";
import { describeIssues } from "../../../../lib/zod-issues";
import {
  DANGER_BUTTON,
  Field,
  FIELD_ON_RAISED,
  PRIMARY_BUTTON,
  Problems,
  Row,
  SECONDARY_BUTTON_SMALL,
  TEXT_BUTTON,
  TEXTAREA_ON_RAISED,
} from "../../../form";
import { Panel } from "../../../panel";
import { Tag } from "../../../tag";

/**
 * The meetings this recruitment is made of: the day, the user's own word for
 * the stage, where it is, and whatever they noted — added, corrected, called
 * off and removed here.
 *
 * It sits in the left column, under what the job asks for and above what the
 * Posting said, because it is what came of the asking. The rail in the right
 * column draws the same meetings as beats in among the rest of what happened
 * (`silence-thread.tsx`); this is where they are recorded.
 *
 * Nothing here is part of the page's Save, and it holds no form of its own —
 * it renders inside the form the rest of the page saves through, and a form
 * inside a form is not a document a browser will honour. Each meeting is its
 * own request on the press, for the reason the Tailored CV's section is: a
 * meeting is not a field of the Job Application, and a diary that only took
 * effect when somebody remembered to press Save would be a way to lose an
 * interview.
 *
 * Arranging one asks whether to move the Status and never moves it alone
 * (ADR-0011). The prompt is part of the feature: without it the common path
 * costs two deliberate actions, and a user who skips the second has a Job
 * Application with a meeting on it sitting in Applied — which is a legal state
 * that nothing repairs behind their back.
 */
export function Interviews({
  jobApplicationId,
  interviews,
  status,
  onChange,
  onMoveToInterviewing,
}: {
  jobApplicationId: string;
  /** In the order they are held, as the Job Application was read. */
  interviews: Interview[];
  /** Where the Job Application stands, which decides whether to ask. */
  status: JobApplication["status"];
  /**
   * Told the list as it now stands. The page holds the Job Application these
   * belong to, and the thread and the silence tag on it read from the same
   * list, so a meeting recorded here has to reach it rather than living in a
   * second copy behind this panel.
   */
  onChange: (interviews: Interview[]) => void | Promise<void>;
  /**
   * Moves the Job Application, when the user answers the prompt with a yes. It
   * is the page's own patch — the same one the Status select sends — because
   * this panel has no business writing a Status (ADR-0011), and it throws
   * whatever the endpoint refused with.
   */
  onMoveToInterviewing: () => Promise<void>;
}) {
  const [arranging, setArranging] = useState(false);
  // Whether the user has been asked about the Status since arranging a meeting.
  // Set on the arrangement rather than standing while the Status disagrees: it
  // is a question about what they have just done, and a page that asked it for
  // as long as the two disagreed would be nagging about a state ADR-0011 says
  // is legal.
  const [asking, setAsking] = useState(false);

  async function record(added: Interview) {
    setArranging(false);
    // Where it will be held rather than at the end of the list: the server
    // answers in that order and the page has to put a new one in the same
    // place, or the list would shuffle on the next load.
    await onChange(inTheOrderHeld([...interviews, added]));
    // Unconditionally, because whether the Status makes the question worth
    // putting is the guard below's to decide, and saying it twice would be two
    // places to change it.
    setAsking(true);
  }

  /**
   * The question answered with a yes, and put away.
   *
   * Cleared on a move that landed as much as on a "leave it alone": it was a
   * question about the meeting that had just been arranged, and it has been
   * answered either way. Left standing it would come back the next time the
   * Status moved off Interviewing — with no meeting just arranged to ask
   * about, which is precisely the nagging about a legal state that setting it
   * on the arrangement is meant to avoid.
   *
   * A refusal leaves it standing, because then the question really is still
   * open, and `MoveTheStatus` says what went wrong.
   */
  async function answer(): Promise<void> {
    await onMoveToInterviewing();
    setAsking(false);
  }

  return (
    <Panel
      aside={
        // On the panel's own header line rather than as a button under the
        // list, so that a Job Application with six meetings on it does not put
        // the way to add a seventh a screen away.
        arranging ? undefined : (
          <button
            className={SECONDARY_BUTTON_SMALL}
            onClick={() => setArranging(true)}
            type="button"
          >
            Arrange one
          </button>
        )
      }
      title="Interviews"
    >
      <div className="flex flex-col gap-4">
        {interviews.length === 0 && !arranging ? (
          <p className="text-[12.5px] leading-[1.55] text-ink-muted">
            Nothing is in the diary. Record a meeting and this Job Application
            stops reading as silence while it stands — and the day shows on its
            card.
          </p>
        ) : (
          <ul className="flex flex-col">
            {interviews.map((interview) => (
              <InterviewRow
                interview={interview}
                jobApplicationId={jobApplicationId}
                key={interview.id}
                onChanged={(changed) =>
                  onChange(
                    inTheOrderHeld(
                      interviews.map((one) =>
                        one.id === changed.id ? changed : one,
                      ),
                    ),
                  )
                }
                onRemoved={() =>
                  onChange(interviews.filter((one) => one.id !== interview.id))
                }
              />
            ))}
          </ul>
        )}

        {asking && status !== "interviewing" && (
          <MoveTheStatus
            onLeave={() => setAsking(false)}
            onMove={answer}
            status={status}
          />
        )}

        {arranging && (
          <ArrangeInterview
            jobApplicationId={jobApplicationId}
            onArranged={record}
            onCancel={() => setArranging(false)}
          />
        )}
      </div>
    </Panel>
  );
}

/**
 * One meeting, as a line that says what it is and when — and, once opened,
 * every box it is made of.
 *
 * Ruled off from the row above rather than boxed, as a Requirement is: three
 * meetings are a recruitment, and three bordered cards would read as a form
 * somebody has to fill in.
 *
 * Calling it off is the one control here that acts on the press with nothing
 * else to confirm. It is a decision rather than a correction — the employer has
 * said so, and there is nothing about it to get wrong — and the meeting keeps
 * its place, marked, because arranging it was still something they did.
 */
function InterviewRow({
  interview,
  jobApplicationId,
  onChanged,
  onRemoved,
}: {
  interview: Interview;
  jobApplicationId: string;
  onChanged: (interview: Interview) => void | Promise<void>;
  onRemoved: () => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState<InterviewEdits>(() =>
    interviewEditsFrom(interview),
  );
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  /** Runs a request, reporting whatever it was refused with against the row. */
  async function attempt(request: () => Promise<void>): Promise<void> {
    setProblems([]);
    setSaving(true);

    try {
      await request();
    } catch (error) {
      setProblems(describeFailure(error));
    } finally {
      setSaving(false);
    }
  }

  async function save(): Promise<void> {
    const changes = UpdateInterview.safeParse(
      interviewChangesFrom(edits, interview),
    );
    if (!changes.success) {
      setProblems(describeIssues(changes.error));
      return;
    }

    if (Object.keys(changes.data).length === 0) {
      setProblems([]);
      setEditing(false);
      return;
    }

    await attempt(async () => {
      await onChanged(
        await patchInterview(jobApplicationId, interview.id, changes.data),
      );
      setEditing(false);
    });
  }

  async function markCancelled(cancelled: boolean): Promise<void> {
    await attempt(async () => {
      await onChanged(
        await patchInterview(jobApplicationId, interview.id, { cancelled }),
      );
    });
  }

  async function remove(): Promise<void> {
    await attempt(async () => {
      await deleteInterview(jobApplicationId, interview.id);
      await onRemoved();
    });
  }

  return (
    <li className="border-t border-line py-2.5 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <span
          className={`text-[13px] leading-[1.35] font-medium ${
            interview.cancelled ? "text-ink-faint line-through" : "text-ink"
          }`}
        >
          {dayOf(interview.heldOn)}
          {interview.heldAt !== null && ` · ${interview.heldAt}`}
        </span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-muted">
          {interview.stage}
        </span>

        {/* A dashed tag rather than a rose one: a meeting that was called off is
            a thing wearing off rather than an error, which is the same reading
            the ghosted silence tag gets. */}
        {interview.cancelled && <Tag tone="ghosted">Called off</Tag>}

        <div className="flex items-center gap-2.5 text-[12.5px]">
          <button
            className={`text-ink-muted hover:text-ink ${TEXT_BUTTON}`}
            disabled={saving}
            onClick={() => {
              // Opened on whatever the server last answered, so a row closed
              // with half an edit in it does not reopen holding it.
              setEdits(interviewEditsFrom(interview));
              setProblems([]);
              setEditing((open) => !open);
            }}
            type="button"
          >
            {editing ? "Close" : "Edit"}
          </button>
          <button
            className={`text-ink-muted hover:text-ink ${TEXT_BUTTON}`}
            disabled={saving}
            onClick={() => markCancelled(!interview.cancelled)}
            type="button"
          >
            {interview.cancelled ? "Put it back" : "Call it off"}
          </button>
        </div>
      </div>

      {(interview.location !== null ||
        interview.meetingUrl !== null ||
        interview.notes !== null) && (
        <p className="mt-1 text-[11.5px] leading-[1.45] text-ink-faint">
          {[
            interview.location,
            interview.meetingUrl === null ? null : "Online",
            interview.notes,
          ]
            .filter((part) => part !== null)
            .join(" · ")}
        </p>
      )}

      {editing && (
        <div className="mt-2.5 flex flex-col gap-3.5">
          <InterviewFields
            edits={edits}
            onEdit={(field, value) =>
              setEdits((current) => ({ ...current, [field]: value }))
            }
          />

          <Problems problems={problems} />

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              className={PRIMARY_BUTTON}
              disabled={saving}
              onClick={save}
              type="button"
            >
              {saving ? "Saving…" : "Save the meeting"}
            </button>

            {/* Removing a meeting is for one recorded by mistake, and it is the
                one thing here that cannot be undone by typing a box back — so
                it sits behind a question, and the question says what to do
                instead where the employer called the meeting off. */}
            {confirmingDelete ? (
              <>
                <p className="text-[12.5px] leading-[1.5] text-ink-muted">
                  Remove this meeting for good? If it was called off, call it
                  off instead — a meeting that was arranged belongs in the
                  month&rsquo;s report.
                </p>
                <button
                  className={DANGER_BUTTON}
                  disabled={saving}
                  onClick={remove}
                  type="button"
                >
                  {saving ? "Removing…" : "Yes, remove it"}
                </button>
                <button
                  className={SECONDARY_BUTTON_SMALL}
                  disabled={saving}
                  onClick={() => setConfirmingDelete(false)}
                  type="button"
                >
                  Keep it
                </button>
              </>
            ) : (
              <button
                className={DANGER_BUTTON}
                disabled={saving}
                onClick={() => setConfirmingDelete(true)}
                type="button"
              >
                Remove it
              </button>
            )}
          </div>
        </div>
      )}

      {!editing && problems.length > 0 && (
        <div className="mt-1.5">
          <Problems problems={problems} />
        </div>
      )}
    </li>
  );
}

/**
 * The meeting being arranged. It opens with today as the day the invitation
 * arrived, which is the ordinary case and is a box rather than a fact: the
 * invitation may have come last week, and the month it arrived in is what the
 * Activity Report reports it in.
 */
function ArrangeInterview({
  jobApplicationId,
  onArranged,
  onCancel,
}: {
  jobApplicationId: string;
  onArranged: (interview: Interview) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [edits, setEdits] = useState<InterviewEdits>(() =>
    blankInterviewEdits(todayInUtc()),
  );
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function arrange(): Promise<void> {
    const interview = CreateInterview.safeParse(arrangedFrom(edits));
    if (!interview.success) {
      setProblems(describeIssues(interview.error));
      return;
    }

    setProblems([]);
    setSaving(true);

    try {
      await onArranged(await postInterview(jobApplicationId, interview.data));
    } catch (error) {
      setProblems(describeFailure(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3.5 rounded-card border border-dashed border-line-strong p-3.5">
      <InterviewFields
        edits={edits}
        onEdit={(field, value) =>
          setEdits((current) => ({ ...current, [field]: value }))
        }
      />

      <Problems problems={problems} />

      <div className="flex flex-wrap items-center gap-2.5">
        <button
          className={PRIMARY_BUTTON}
          disabled={saving}
          onClick={arrange}
          type="button"
        >
          {saving ? "Recording…" : "Arrange it"}
        </button>
        <button
          className={SECONDARY_BUTTON_SMALL}
          disabled={saving}
          onClick={onCancel}
          type="button"
        >
          Never mind
        </button>
      </div>
    </div>
  );
}

/**
 * The boxes a meeting is made of, shared by the row being corrected and the one
 * being arranged — so a rescheduled meeting is edited in exactly the fields it
 * was recorded in.
 *
 * Enter is caught in every one of them. These boxes stand inside the form the
 * rest of the page saves through, and Enter in a box inside a form submits the
 * form — which here would save the page and leave the meeting unrecorded.
 */
function InterviewFields({
  edits,
  onEdit,
}: {
  edits: InterviewEdits;
  onEdit: (field: keyof InterviewEdits, value: string) => void;
}) {
  const box = (field: keyof InterviewEdits) => ({
    className: FIELD_ON_RAISED,
    onChange: (event: { target: { value: string } }) =>
      onEdit(field, event.target.value),
    onKeyDown: (event: { key: string; preventDefault: () => void }) => {
      if (event.key === "Enter") event.preventDefault();
    },
    value: edits[field],
  });

  return (
    <div className="flex flex-col gap-3">
      <Row>
        <Field label="Held on">
          <input type="date" {...box("heldOn")} />
        </Field>
        <Field label="At">
          <input type="time" {...box("heldAt")} />
        </Field>
      </Row>

      <Row>
        <Field label="Stage">
          <input
            placeholder="Phone screen, take-home review…"
            {...box("stage")}
          />
        </Field>
        <Field label="Arranged on">
          <input type="date" {...box("arrangedOn")} />
        </Field>
      </Row>

      <Row>
        <Field label="Where">
          <input placeholder="Their office, 4th floor" {...box("location")} />
        </Field>
        <Field label="Meeting link">
          <input placeholder="No link" {...box("meetingUrl")} />
        </Field>
      </Row>

      <Field label="Notes">
        <textarea
          className={TEXTAREA_ON_RAISED}
          onChange={(event) => onEdit("notes", event.target.value)}
          placeholder="Who you are meeting, what to ask."
          rows={3}
          value={edits.notes}
        />
      </Field>
    </div>
  );
}

/**
 * The question ADR-0011 is about, asked once, on the arrangement that earns it.
 *
 * It offers and never acts. A Status is where the user puts a Job Application
 * and is never inferred — a coffee with a recruiter is a meeting and not a
 * recruitment, and a second round may be booked on a Job Application the user
 * has already decided to withdraw from — so the two buttons are a real choice
 * and "Leave it" is not the lesser of them.
 *
 * There is no wit in it. It is about the one column in the product that is
 * nobody's reading but the user's, so it says plainly what is true now and what
 * pressing each button does.
 */
function MoveTheStatus({
  status,
  onMove,
  onLeave,
}: {
  status: JobApplication["status"];
  onMove: () => Promise<void>;
  onLeave: () => void;
}) {
  const [problems, setProblems] = useState<string[]>([]);
  const [moving, setMoving] = useState(false);

  async function move(): Promise<void> {
    setProblems([]);
    setMoving(true);

    try {
      await onMove();
    } catch (error) {
      setProblems(describeFailure(error));
      setMoving(false);
    }
  }

  return (
    <div
      aria-live="polite"
      className="flex flex-col gap-2.5 rounded-card border border-line bg-paper-sunk px-3.5 py-3"
    >
      <p className="text-[12.5px] leading-[1.5] text-ink-muted">
        A meeting is in the diary and this Job Application still stands at{" "}
        {JOB_STATUS_LABELS[status]}. Move it to Interviewing?
      </p>

      <Problems problems={problems} />

      <div className="flex flex-wrap items-center gap-2.5">
        <button
          className={SECONDARY_BUTTON_SMALL}
          disabled={moving}
          onClick={move}
          type="button"
        >
          {moving ? "Moving…" : "Move it to Interviewing"}
        </button>
        <button
          className={SECONDARY_BUTTON_SMALL}
          disabled={moving}
          onClick={onLeave}
          type="button"
        >
          Leave the Status alone
        </button>
      </div>
    </div>
  );
}
