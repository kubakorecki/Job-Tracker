"use client";

import { useState } from "react";
import { describeFailure } from "../../../../lib/api/client";
import type { AnalysisOrNone } from "../../../../lib/analysis/contract";
import { dayOf } from "../../../../lib/day";
import { Problems, SECONDARY_BUTTON_SMALL } from "../../../form";
import { Panel } from "../../../panel";

/**
 * The Analysis, as the one thing on this page the user asks for rather than
 * types: the control that runs it, the wait while the model reads, and the
 * banner that says the answer it gave has stopped describing the world.
 *
 * One control and one only. Running an Analysis spends from the user's AI
 * Usage, so it is never something the page does on its own — not on opening,
 * not on saving, not on a Requirement changing — and there is nothing here
 * that runs one over more than the Job Application in front of the user. The
 * daily Model Call count is never mentioned here or anywhere else the user can
 * see (ADR-0009).
 *
 * Nothing here mentions plans, tiers or payment, and nothing should: whether
 * this is one day sold is a question about an endpoint, and the user is being
 * told what a button does rather than what it might one day cost.
 */

export function AnalysisSection({
  analysis,
  unsaved,
  onRun,
}: {
  /** The last run and what has become of it, or `null` where none has run. */
  analysis: AnalysisOrNone;
  /**
   * Whether the Requirements on screen have been changed and not yet saved. An
   * Analysis reads what the database holds, so running one now would answer
   * about a list the user is no longer looking at.
   */
  unsaved: boolean;
  /** Runs one, and throws whatever the endpoint refused with. */
  onRun: () => Promise<void>;
}) {
  const [running, setRunning] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  async function run() {
    setProblems([]);
    setRunning(true);

    try {
      await onRun();
    } catch (error) {
      // Whatever the endpoint said, in its own words. The four refusals are
      // worded apart on purpose — nothing to analyse, no CV to analyse
      // against, a provider that could not be reached, and a spent allowance —
      // and the last two are the pair that matter most here: one says try
      // again shortly and the other says the day's calls are gone.
      setProblems(describeFailure(error));
    } finally {
      setRunning(false);
    }
  }

  return (
    <Panel
      aside={
        <button
          className={SECONDARY_BUTTON_SMALL}
          disabled={running || unsaved}
          onClick={run}
          type="button"
        >
          {running
            ? "Reading…"
            : analysis === null
              ? "Run an Analysis"
              : "Run it again"}
        </button>
      }
      title="Analysis"
    >
      <div className="flex flex-col gap-[11px]">
        {analysis?.stale === true && <Stale ranAt={analysis.ranAt} />}

        <p className="text-[12.5px] leading-[1.55] text-ink-muted">
          {analysis === null ? (
            <>
              A deeper reading than the automatic comparison: the model reads
              your CV against each Requirement and says in a line what it makes
              of it.
            </>
          ) : (
            <>
              Ran on {dayOf(analysis.ranAt)} against your Profile. The model
              read the Posting and said what it thought each Requirement asks
              for, and whether your CV answers it.
            </>
          )}
        </p>

        {analysis !== null && analysis.rating !== null && (
          <InterviewChance
            feedback={analysis.feedback}
            rating={analysis.rating}
          />
        )}

        <p className="text-[12.5px] leading-[1.55] text-ink-faint">
          Analysing spends from this month&rsquo;s AI Usage.
        </p>

        {running && (
          // A model call takes seconds, and a button that simply went quiet
          // for them would read as a page that had stopped working — the same
          // reason the CV upload says what it is waiting for.
          <p
            aria-live="polite"
            className="text-[12.5px] leading-[1.55] text-ink-muted"
            role="status"
          >
            Reading your CV against these Requirements… the model is being asked
            about each one, which takes a few seconds.
          </p>
        )}

        {unsaved && (
          <p className="text-[12.5px] leading-[1.55] text-ink-muted">
            Save your changes first. An Analysis reads the Requirements as they
            are saved, so it would answer about the list you have just changed.
          </p>
        )}

        <Problems problems={problems} />
      </div>
    </Panel>
  );
}

/**
 * The HR reading of the run as a whole: a rating out of ten of the
 * candidate's chance of an interview, and the one paragraph on what would
 * raise it. It sits under the per-Requirement badges and stays as long as the
 * Analysis does, stale or not — the same reasoning a re-run overwrites either
 * way.
 */
function InterviewChance({
  feedback,
  rating,
}: {
  rating: number;
  feedback: string | null;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-card border border-line bg-paper-raised px-3 py-3">
      <p className="flex items-baseline gap-1.5 text-[12.5px] leading-[1.55] text-ink-muted">
        <span>Chance of an interview:</span>
        <span className="font-display text-[17px] leading-[1.2] text-ink">
          {rating}
          <span className="text-[12.5px] text-ink-faint">/10</span>
        </span>
      </p>

      {feedback !== null && feedback !== "" && (
        <p className="text-[12.5px] leading-[1.55] text-ink-muted">
          {feedback}
        </p>
      )}
    </div>
  );
}

/**
 * The banner over a verdict that no longer describes anything: the CV it read
 * or the Requirements it read have moved since, so what it concluded is about
 * a document or a list that is not there any more.
 *
 * It says which two things could have moved rather than which one did.
 * Answering that exactly would mean keeping what the run read, and the user
 * knows what they changed; what they cannot know is that a verdict they are
 * looking at is older than the change.
 *
 * It does not promise that the old verdicts are still below it, because one of
 * the two changes takes them with it: saving an edit to the Requirements
 * replaces every row, and a row's analysed reading goes with the row. A CV
 * that has moved leaves them all standing, greyed. The banner reads the same
 * either way, and says the one thing that is true of both — what the model
 * last said was about something that is no longer there.
 *
 * It is shown only when the endpoint says `stale`, which is already silent for
 * a Job Application past `applied` — there is nothing to be done about a CV
 * that has moved on once the application is with somebody else, and offering a
 * model call for it would be asking the user to spend on a document they can
 * no longer send.
 */
function Stale({ ranAt }: { ranAt: string }) {
  return (
    <p
      className="flex items-start gap-2.5 rounded-[7px] border border-ember bg-ember-tint px-3 py-2.5 text-xs leading-[1.5] text-ember"
      role="status"
    >
      <Warn />
      <span>
        This Analysis is out of date. Your CV or what this job asks for has
        changed since it ran on {dayOf(ranAt)}, so what it concluded is about
        something that is no longer there. Run it again to have the model read
        what is there now.
      </span>
    </p>
  );
}

/** 24px grid, 1.7px stroke, `currentColor`, no fill — as every icon is. */
function Warn() {
  return (
    <svg
      aria-hidden="true"
      className="mt-px shrink-0"
      fill="none"
      height="15"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width="15"
    >
      <path d="M12 8v5" />
      <path d="M12 16.5v.01" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
