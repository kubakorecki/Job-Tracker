"use client";

import type { StatusChange } from "@repo/schema";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  sameReport,
  withCell,
  withNotes,
  withoutRow,
  withRowAdded,
} from "../../../lib/activity-report/edits";
import {
  monthOfDay,
  monthsUpTo,
  MONTHS_OFFERED,
  previousMonth,
  type Month,
} from "../../../lib/activity-report/month";
import {
  activityReportFor,
  MONTHLY_MINIMUM,
  shortOfContacts,
  type Reportable,
} from "../../../lib/activity-report/report";
import {
  LANGUAGE_LABELS,
  LANGUAGES,
  monthInWords,
  type Language,
} from "../../../lib/activity-report/wording";
import {
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  SECONDARY_BUTTON_SMALL,
  SELECT,
} from "../../form";
import { Segmented } from "../../segmented";
import { Loading, Skeleton } from "../../states";
import { ReportSheet } from "./report-sheet";
import { useBrowserDay } from "./use-browser-day";
import { discardDraft, keepDraft, useDraft } from "./use-draft";
import { useReportLanguage, useReportName } from "./use-report-preferences";

/**
 * A month of the job search, proposed from the record and finished by hand.
 *
 * Everything here happens in the browser. The page was handed the Job
 * Applications and the Status Changes; the report for whichever month is
 * chosen is proposed from them without going back to the server, the draft
 * sits in browser storage, and the PDF is the browser's own Save as PDF. There
 * is no endpoint behind any of it, because an Activity Report is never stored
 * — it is generated for a month, edited, printed, and remembered only by the
 * office (`CONTEXT.md`).
 *
 * The month's boundaries are the reader's zone rather than UTC, which is the
 * one place this app departs from the fixed zone everything else is dated in
 * (ADR-0012). The departure is safe precisely because nothing here renders on
 * the server: there is no second render for the two to disagree between. Until
 * the browser has said where it is, the page says it is loading rather than
 * guessing.
 *
 * What is on screen is either the report as it was proposed or the draft the
 * user has been typing into, and the difference is what every confirmation
 * here turns on: nothing asks the user anything while there is nothing of
 * theirs to lose.
 */
export function ActivityReportPage({
  jobApplications,
  statusChanges,
}: {
  jobApplications: Reportable[];
  statusChanges: StatusChange[];
}) {
  const router = useRouter();
  const [language, chooseLanguage] = useReportLanguage();
  const [name, setName] = useReportName();
  const browser = useBrowserDay();

  /** The month the user asked for, or `null` while the default stands. */
  const [chosen, setChosen] = useState<Month | null>(null);

  // The month that has finished, which is the one a report is handed in for.
  // It cannot be worked out until the browser has said what day it is where
  // the reader is standing.
  const month =
    chosen ??
    (browser === null ? null : previousMonth(monthOfDay(browser.today)));

  const proposed = useMemo(
    () =>
      browser === null || month === null
        ? null
        : activityReportFor({
            month,
            language,
            zone: browser.zone,
            jobApplications,
            statusChanges,
          }),
    [browser, month, language, jobApplications, statusChanges],
  );

  // What the user has typed into this month in this language — a different
  // document from the same month in the other one, which is why the draft is
  // filed under both and read back under both.
  const draft = useDraft(month, language);

  const showing = draft ?? proposed;

  /**
   * Everything the sheet needs, or nothing at all. It is one value rather than
   * three checks so that the page below can read the browser's day without
   * asserting that it is there: on the server it is not, and that is the whole
   * reason this page renders a wait first.
   */
  const ready =
    browser !== null && month !== null && showing !== null
      ? { browser, month, showing }
      : null;

  /** Whether there is anything of the user's own on the sheet. */
  const edited =
    draft !== null && proposed !== null && !sameReport(draft, proposed);

  /**
   * The question standing, where one is. Two shapes rather than a language and
   * a string sharing one slot: "switch to English" and "generate again" are
   * different questions with different answers, and a `"again"` that had to be
   * told apart from a `Language` at every use was one `===` away from asking
   * the wrong one.
   */
  const [asking, setAsking] = useState<Asked | null>(null);

  /**
   * The record as it now stands, in place of what the user had.
   *
   * It refreshes as well as discarding, which is what makes "as it now stands"
   * true rather than nearly true. The Job Applications and the Status Changes
   * came down with the page, so without this the user would be handed back the
   * same sheet they asked to have made again — and the case for pressing it is
   * precisely that something has been recorded since, often in the tab they
   * have just come back from. The refresh re-runs the server component and the
   * new props arrive as an ordinary render.
   */
  function generateAgain() {
    if (month === null) return;
    discardDraft(month, language);
    router.refresh();
    setAsking(null);
  }

  function switchTo(next: Language) {
    chooseLanguage(next);
    setAsking(null);
  }

  return (
    <>
      <div className="print:hidden">
        <h1 className="type-statement max-w-[900px] text-pretty">
          Your month, <span className="text-ink-faint">on one page.</span>
        </h1>
        <p className="mt-1.5 max-w-[620px] type-body text-ink-muted">
          Every Job Application something happened on, proposed from what you
          recorded. Reword any of it — the sheet is yours, and nothing you type
          here is saved anywhere but this browser.
        </p>
      </div>

      {ready === null ? (
        // Drawn rather than only written, like every other wait in the app: a
        // skeleton is furniture to a screen reader and the sentence is what
        // they get, but this is the wait *every* reader sees — the server has
        // no zone and so renders no report at all (ADR-0012) — rather than
        // only the first reader on a cold route, which is `loading.tsx`'s.
        <Loading what="your month">
          <Skeleton className="h-[34px] w-[520px] max-w-full rounded-control" />
          <Skeleton className="mt-2 h-[420px] w-full max-w-[880px] rounded-panel" />
        </Loading>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2.5 print:hidden">
            <div className="w-[220px] shrink-0">
              <select
                aria-label="The month to report on"
                className={SELECT}
                onChange={(event) => {
                  setChosen(event.target.value);
                  // A question about this month is not a question about the
                  // next one, and leaving it standing would have the user
                  // answering it for a sheet they can no longer see.
                  setAsking(null);
                }}
                value={ready.month}
              >
                {monthsUpTo(
                  monthOfDay(ready.browser.today),
                  MONTHS_OFFERED,
                ).map((option) => (
                  <option key={option} value={option}>
                    {monthInWords(option, language)}
                  </option>
                ))}
              </select>
            </div>

            <Segmented
              label="Language"
              onChoose={(next) =>
                next === language
                  ? undefined
                  : edited
                    ? setAsking({ kind: "switch", to: next })
                    : switchTo(next)
              }
              options={LANGUAGES.map((option) => ({
                value: option,
                label: LANGUAGE_LABELS[option],
              }))}
              value={language}
            />

            <div className="flex-1" />

            <button
              className={SECONDARY_BUTTON}
              onClick={() =>
                edited ? setAsking({ kind: "again" }) : generateAgain()
              }
              type="button"
            >
              Generate again
            </button>

            {/* The browser's own Save as PDF, which is the whole of how this
                becomes a document. There is no PDF library here and nothing
                on the server draws one. */}
            <button
              className={PRIMARY_BUTTON}
              onClick={() => window.print()}
              type="button"
            >
              Print
            </button>
          </div>

          {asking !== null && (
            <Asking
              asked={asking}
              language={language}
              onNo={() => setAsking(null)}
              onYes={() =>
                asking.kind === "again" ? generateAgain() : switchTo(asking.to)
              }
            />
          )}

          {/* In the view only, and `print:hidden` with everything else of the
              application's: the office does not need telling that its own
              minimum was not met. It never stops the user printing either —
              how many contacts a month needs is between them and the office,
              and a tracker that refused would be the wrong thing standing in
              the way.

              The live region is always here and its contents change, rather
              than the region itself coming and going: a region that appears
              with its message already in it is one a screen reader has no
              change to announce. */}
          <div aria-live="polite" className="print:hidden">
            {shortOfContacts(ready.showing) && (
              <p className="rounded-panel border border-ember bg-ember-tint px-3.5 py-2.5 text-[12.5px] text-ember">
                {shortfall(ready.showing.rows.length, ready.month, language)}
              </p>
            )}
          </div>

          <div className="max-w-[880px] print:max-w-none">
            <ReportSheet
              name={name}
              onAddRow={() =>
                keepDraft(withRowAdded(ready.showing, crypto.randomUUID()))
              }
              onCell={(id, cell, text) =>
                keepDraft(withCell(ready.showing, id, cell, text))
              }
              onName={setName}
              onNotes={(notes) => keepDraft(withNotes(ready.showing, notes))}
              onRemoveRow={(id) => keepDraft(withoutRow(ready.showing, id))}
              report={ready.showing}
              today={ready.browser.today}
            />
          </div>
        </>
      )}
    </>
  );
}

/** A question waiting to be answered: which language to move to, or none. */
type Asked = { kind: "switch"; to: Language } | { kind: "again" };

/**
 * The one question this page asks, in its two forms — and it asks only when
 * there is something of the user's own on the sheet.
 *
 * Switching language does not translate what they typed and is not meant to:
 * the two languages are two documents, filed separately, and the Polish they
 * wrote is still there when they switch back. The sentence says so, because a
 * user who expected a translation would otherwise think they had lost it.
 *
 * Generating again is the destructive one. It is the only thing on this page
 * that throws away work, so it is the only one worded as a warning.
 */
function Asking({
  asked,
  language,
  onYes,
  onNo,
}: {
  asked: Asked;
  /** The language the sheet on screen is in, which the question is about. */
  language: Language;
  onYes: () => void;
  onNo: () => void;
}) {
  const saidIn = LANGUAGE_LABELS[language];

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-panel border border-line bg-paper-sunk px-3.5 py-2.5 text-[12.5px] text-ink-muted print:hidden">
      <p className="flex-1 min-w-[280px]">
        {asked.kind === "again"
          ? "Generating again proposes this month from the record as it now stands. What you have typed into this sheet goes."
          : `${LANGUAGE_LABELS[asked.to]} is a separate sheet, and nothing of yours is translated into it. What you have typed in ${saidIn} stays where it is, and comes back when you switch back.`}
      </p>
      <span className="flex items-center gap-2">
        <button
          className={SECONDARY_BUTTON_SMALL}
          onClick={onYes}
          type="button"
        >
          {asked.kind === "again" ? "Yes, generate it again" : "Switch"}
        </button>
        <button className={SECONDARY_BUTTON_SMALL} onClick={onNo} type="button">
          Leave it
        </button>
      </span>
    </div>
  );
}

/**
 * What a month short of the minimum says. Plainly, and without implying the
 * user did too little — the tracker knows what was recorded in it and nothing
 * about what the month was like.
 */
function shortfall(rows: number, month: Month, language: Language): string {
  const named = monthInWords(month, language);

  if (rows === 0) {
    return `Nothing is recorded for ${named}. The office asks for ${MONTHLY_MINIMUM} contacts a month — add the rows you need before you print this.`;
  }

  const contacts = rows === 1 ? "1 contact" : `${rows} contacts`;

  return `${contacts} for ${named}. The office asks for ${MONTHLY_MINIMUM} a month; rows you add yourself count.`;
}
