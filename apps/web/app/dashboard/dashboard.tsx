"use client";

import { JobStatus, type JobApplication } from "@repo/schema";
import { JOB_STATUS_LABELS } from "@repo/ui/status-badge";
import { useMemo, useState } from "react";
import { describeFailure } from "../../lib/api/client";
import { todayInUtc } from "../../lib/day";
import { tallyClauses, tallyOf } from "../../lib/dashboard/tally";
import { DASHBOARD_VIEWS, type DashboardView } from "../../lib/dashboard/view";
import {
  emptiness,
  matching,
  NO_FILTER,
  SILENCE_FILTERS,
  type JobApplicationFilter,
  type SilenceFilter,
} from "../../lib/job-applications/filtering";
import { AppBar, Page, PageBody } from "../app-bar";
import { PRIMARY_BUTTON, SELECT } from "../form";
import { Failure } from "../states";
import { AddJobApplicationForm } from "./add-job-application-form";
import { Board } from "./board";
import { JobApplicationTable } from "./job-application-table";
import { MoveFailure } from "./move-failure";
import { NothingToShow } from "./nothing-to-show";
import { useDashboardView } from "./use-dashboard-view";
import {
  useJobApplications,
  useMoveJobApplication,
} from "./use-job-applications";

const VIEW_LABELS: Record<DashboardView, string> = {
  board: "Board",
  table: "Table",
};

const SILENCE_LABELS: Record<SilenceFilter, string> = {
  all: "Everything",
  cold: "Going cold",
  ghosted: "Ghosted",
};

/**
 * The Job Applications, however the user wants to look at them.
 *
 * This is where the one cached list is read, and the board and the table are
 * each handed what is left of it once the search, the Status filter and the
 * silence filter have had their say — so the two views and the toolbar can
 * never be looking at different data.
 *
 * The tally above the toolbar is read from the whole list rather than the
 * narrowed one. It is a statement about the user's job hunt; a tally that
 * moved as they typed in the search box would be a statement about the search
 * box.
 *
 * Moving a card is owned here rather than by the board, because a move outlives
 * the view it was made in: the user can switch to the table while the request
 * is still in flight, and the failure has to survive that to be explained.
 *
 * A view with nothing in it is answered here too, rather than by each of them:
 * the board and the table are handed the same narrowed list, so "you have none"
 * and "none of yours match" are the same two answers whichever one is on show.
 */
export function Dashboard({
  email,
  initialJobApplications,
}: {
  email: string;
  initialJobApplications: JobApplication[];
}) {
  const {
    data: jobApplications,
    error,
    isError,
    refetch,
  } = useJobApplications(initialJobApplications);
  const { failures, move, retry, dismiss } = useMoveJobApplication();
  const [view, chooseView] = useDashboardView();
  const [filter, setFilter] = useState<JobApplicationFilter>(NO_FILTER);
  const [tracking, setTracking] = useState(false);

  // One day for the whole render, so a card, a tag and the tally cannot fall
  // either side of midnight from one another.
  const today = todayInUtc();

  const shown = useMemo(
    () => matching(jobApplications, filter, today),
    [jobApplications, filter, today],
  );
  const tally = useMemo(
    () => tallyOf(jobApplications, today),
    [jobApplications, today],
  );

  const nothingToShow = emptiness(jobApplications, shown, filter);

  const narrow = <Part extends keyof JobApplicationFilter>(
    part: Part,
    value: JobApplicationFilter[Part],
  ) => setFilter((current) => ({ ...current, [part]: value }));

  return (
    <Page>
      <AppBar
        action={
          <button
            aria-expanded={tracking}
            className={PRIMARY_BUTTON}
            onClick={() => setTracking((open) => !open)}
            type="button"
          >
            <Plus />
            Track a job
          </button>
        }
        email={email}
      />

      <PageBody>
        {/* A re-read that failed leaves the last good list on screen rather
            than emptying the board, so this says the list may be out of date
            and offers the only thing that would put it right. */}
        {isError && (
          <Failure
            onRetry={() => refetch()}
            problems={describeFailure(error)}
            standing="The board below is the last good copy. Anything you change now may not save."
            what="the latest Job Applications"
          />
        )}

        {/* Read from every Job Application rather than the narrowed list: a
            search typed after the move failed must not cost the message the
            name of what failed. */}
        {failures.map((failed) => (
          <MoveFailure
            company={
              jobApplications.find(({ id }) => id === failed.move.id)?.company
            }
            failed={failed}
            key={failed.move.id}
            onDismiss={() => dismiss(failed)}
            onRetry={() => retry(failed)}
          />
        ))}

        {/* Opened from the bar rather than standing under it: recording a job
            by hand is the rarer of the two ways one arrives, and the board is
            what the user came for. */}
        {tracking && (
          <section className="rounded-panel border border-line bg-paper-raised p-[18px]">
            <h2 className="type-eyebrow mb-3.5 text-ink-muted">Track a job</h2>
            <AddJobApplicationForm onSaved={() => setTracking(false)} />
          </section>
        )}

        {/* Nothing to narrow and nothing to lay out two ways: with no Job
            Applications at all these controls are furniture in front of an
            invitation to record the first one. */}
        {jobApplications.length > 0 && (
          <>
            <div>
              <p className="type-statement max-w-[900px] text-pretty">
                {tallyClauses(tally).map(({ count, says }) => (
                  <span key={says}>
                    <span
                      className={says.includes("quiet") ? "text-spectre" : ""}
                    >
                      {count}
                    </span>{" "}
                    <span className="text-ink-faint">{says} </span>
                  </span>
                ))}
              </p>
              <p className="mt-1.5 max-w-[620px] type-body text-ink-muted">
                Silence is measured from the day you last heard anything. Nobody
                owes you a reply — but it helps to know who is not sending one.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Search
                onChange={(search) => narrow("search", search)}
                value={filter.search}
              />

              {/* The select fills what it is given, so its width is the
                  toolbar's business rather than its own — and it has to be,
                  because a `w-[148px]` on the control itself would lose to the
                  `w-full` in `SELECT` (see `form.tsx`). */}
              <div className="w-[148px] shrink-0">
                <select
                  aria-label="Filter by Status"
                  className={SELECT}
                  onChange={(event) =>
                    narrow(
                      "status",
                      event.target.value === ""
                        ? null
                        : (event.target.value as JobStatus),
                    )
                  }
                  value={filter.status ?? ""}
                >
                  <option value="">Any Status</option>
                  {JobStatus.options.map((status) => (
                    <option key={status} value={status}>
                      {JOB_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>

              <Segmented
                label="Silence"
                onChoose={(silence) => narrow("silence", silence)}
                options={SILENCE_FILTERS.map((option) => ({
                  value: option,
                  label: SILENCE_LABELS[option],
                  count:
                    option === "cold"
                      ? tally.cold
                      : option === "ghosted"
                        ? tally.ghosted
                        : undefined,
                }))}
                value={filter.silence}
              />

              <div className="flex-1" />

              <Segmented
                label="View"
                onChoose={chooseView}
                options={DASHBOARD_VIEWS.map((option) => ({
                  value: option,
                  label: VIEW_LABELS[option],
                }))}
                value={view}
              />
            </div>

            {/* Said out loud as the user types, since with no spinner and no
                delay this count is the only sign the toolbar did anything. */}
            <p aria-live="polite" className="type-meta">
              {shown.length === jobApplications.length
                ? `${jobApplications.length} Job Applications`
                : `Showing ${shown.length} of ${jobApplications.length} Job Applications`}
            </p>
          </>
        )}

        {nothingToShow !== null ? (
          <NothingToShow
            emptiness={nothingToShow}
            onShowEverything={() => setFilter(NO_FILTER)}
            onTrackAJob={() => setTracking(true)}
          />
        ) : view === "board" ? (
          <Board jobApplications={shown} onMove={move} />
        ) : (
          <JobApplicationTable jobApplications={shown} />
        )}
      </PageBody>
    </Page>
  );
}

/** The search box, with the one icon that says what it is for. */
function Search({
  value,
  onChange,
}: {
  value: string;
  onChange: (search: string) => void;
}) {
  return (
    <div className="relative w-[268px] shrink-0">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute top-[10px] left-2.5 text-ink-faint"
        fill="none"
        height="14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
        viewBox="0 0 24 24"
        width="14"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        aria-label="Search by company or job title"
        className="h-[34px] w-full rounded-control border border-line-strong bg-paper-raised pr-2.5 pl-[31px] text-[13px] text-ink placeholder:text-ink-faint focus:border-spectre focus:ring-3 focus:ring-spectre-tint focus-visible:outline-none"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Company or job title"
        type="search"
        value={value}
      />
    </div>
  );
}

/**
 * One choice out of a short closed set, laid out as one control rather than as
 * a row of buttons: the options are alternatives, and a segmented control is
 * the shape that says so.
 */
function Segmented<Value extends string>({
  label,
  value,
  options,
  onChoose,
}: {
  label: string;
  value: Value;
  options: { value: Value; label: string; count?: number }[];
  onChoose: (value: Value) => void;
}) {
  return (
    <div
      aria-label={label}
      className="inline-flex shrink-0 overflow-hidden rounded-control border border-line-strong bg-paper-raised"
      role="group"
    >
      {options.map((option) => (
        <button
          aria-pressed={option.value === value}
          className={`h-[32px] border-r border-line-strong px-3 text-[12.5px] font-medium last:border-r-0 ${
            option.value === value
              ? "bg-ink text-paper-raised"
              : "text-ink-muted hover:text-ink"
          }`}
          key={option.value}
          onClick={() => onChoose(option.value)}
          type="button"
        >
          {option.label}
          {option.count !== undefined && (
            <span
              className={`ml-1.5 font-normal ${
                option.value === value ? "text-paper-sunk" : "text-ink-faint"
              }`}
            >
              {option.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function Plus() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="14"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
