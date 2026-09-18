"use client";

import {
  languageFrom,
  REPORT_LANGUAGE_KEY,
} from "../../../lib/activity-report/wording";
import { rememberedChoice } from "../remembered";

/**
 * The two things the report remembers about the user between months: the
 * language they last generated in, and their own name.
 *
 * Both sit in browser storage beside the dashboard's own preferences, and for
 * the same reason: they are how this user fills in this form, not part of the
 * address of anything. The draft itself is remembered too, but not here — it
 * is filed per month and language and is read through `../../lib/activity-report/draft`.
 *
 * Nothing about any of it reaches the server. An Activity Report is never
 * stored (`CONTEXT.md`), and a name is the last thing to start storing on
 * somebody's behalf when the only thing it is for is the top of a page they
 * print themselves.
 */

/**
 * Where the name is kept. Here rather than in `lib/activity-report/` with the
 * language's key and the draft's, because there is nothing in `lib` that reads
 * it: the name is not part of the report and never reaches the generator — it
 * is a line in the header, and this is the only thing that puts it there.
 */
const REPORT_NAME_KEY = "job-tracker:report-name";

/** The language the user last generated a report in. */
export const useReportLanguage = rememberedChoice({
  key: REPORT_LANGUAGE_KEY,
  from: languageFrom,
});

/**
 * The name at the top of the sheet. Typed once and remembered, because it is
 * the same name every month and retyping it twelve times a year is the sort of
 * thing the tracker exists to stop.
 *
 * Empty is a real answer rather than a missing one: a user who has not typed
 * it yet gets an empty box with the word for it beside it, and a sheet printed
 * before they fill it in has a blank where the office expects a name — which
 * is visible, which is the point.
 */
export const useReportName = rememberedChoice({
  key: REPORT_NAME_KEY,
  from: (stored) => stored ?? "",
});
