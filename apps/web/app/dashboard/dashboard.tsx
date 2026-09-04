"use client";

import { JobStatus, type JobApplication } from "@repo/schema";
import { JOB_STATUS_LABELS } from "@repo/ui/status-badge";
import { useMemo, useState } from "react";
import { describeFailure } from "../../lib/api/client";
import { DASHBOARD_VIEWS, type DashboardView } from "../../lib/dashboard/view";
import {
  emptiness,
  matching,
  NO_FILTER,
  type JobApplicationFilter,
} from "../../lib/job-applications/filtering";
import { Board } from "./board";
import { FIELD, Field } from "../form";
import { JobApplicationTable } from "./job-application-table";
import { MoveFailure } from "./move-failure";
import { NothingToShow } from "./nothing-to-show";
import { Failure } from "../states";
import { useDashboardView } from "./use-dashboard-view";
import {
  useJobApplications,
  useMoveJobApplication,
} from "./use-job-applications";

const VIEW_LABELS: Record<DashboardView, string> = {
  board: "Board",
  table: "Table",
};

/**
 * The Job Applications, however the user wants to look at them.
 *
 * This is where the one cached list is read, and the board and the table are
 * each handed what is left of it once the search and the Status filter have
 * had their say — so the two views and the search can never be looking at
 * different data.
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
  initialJobApplications,
}: {
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

  const shown = useMemo(
    () => matching(jobApplications, filter),
    [jobApplications, filter],
  );

  const nothingToShow = emptiness(jobApplications, shown, filter);

  const narrow = <Part extends keyof JobApplicationFilter>(
    part: Part,
    value: JobApplicationFilter[Part],
  ) => setFilter((current) => ({ ...current, [part]: value }));

  return (
    <div className="flex flex-col gap-4">
      {/* A re-read that failed leaves the last good list on screen rather than
          emptying the board, so this says the list may be out of date and
          offers the only thing that would put it right. */}
      {isError && (
        <Failure
          onRetry={() => refetch()}
          problems={describeFailure(error)}
          what="the latest Job Applications"
        />
      )}

      {/* Read from every Job Application rather than the narrowed list: a
          search typed after the move failed must not cost the message the name
          of what failed. */}
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

      {/* Nothing to narrow and nothing to lay out two ways: with no Job
          Applications at all these controls are furniture in front of an
          invitation to record the first one. */}
      {jobApplications.length > 0 && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Search">
              <input
                className={FIELD}
                onChange={(event) => narrow("search", event.target.value)}
                placeholder="Company or job title"
                type="search"
                value={filter.search}
              />
            </Field>

            <Field label="Status">
              <select
                className={FIELD}
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
            </Field>

            <ViewToggle onChoose={chooseView} view={view} />
          </div>

          {/* Said out loud as the user types, since with no spinner and no delay
          this count is the only sign the search did anything at all. */}
          <p aria-live="polite" className="text-sm opacity-60">
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
        />
      ) : view === "board" ? (
        <Board jobApplications={shown} onMove={move} />
      ) : (
        <JobApplicationTable jobApplications={shown} />
      )}
    </div>
  );
}

/** Which of the two views is on show, remembered for next time. */
function ViewToggle({
  view,
  onChoose,
}: {
  view: DashboardView;
  onChoose: (view: DashboardView) => void;
}) {
  return (
    <div
      aria-label="View"
      className="inline-flex shrink-0 overflow-hidden rounded-md border border-neutral-300 dark:border-neutral-700"
      role="group"
    >
      {DASHBOARD_VIEWS.map((option) => (
        <button
          aria-pressed={option === view}
          className={`px-3 py-2 text-sm font-medium ${
            option === view
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
              : "opacity-70"
          }`}
          key={option}
          onClick={() => onChoose(option)}
          type="button"
        >
          {VIEW_LABELS[option]}
        </button>
      ))}
    </div>
  );
}
