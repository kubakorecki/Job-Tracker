import { z } from "zod";
import type { Month } from "./month";
import type { ActivityReport } from "./report";
import { Language } from "./wording";

/**
 * The unsent draft, in browser storage and nowhere else.
 *
 * Nothing about an Activity Report is persisted on the server: it is generated
 * for a month, edited, printed, and remembered only by the office
 * (`CONTEXT.md`). But a document the user is halfway through typing must
 * survive a reload, so the draft they are working on sits in `localStorage` —
 * which is this user's own browser, and is the only place it goes.
 *
 * One draft per month and language, because the two are different documents
 * rather than two views of one: switching to English does not translate what
 * the user typed in Polish, so the Polish stays where it was and comes back
 * when they switch back.
 *
 * Only an edited report is ever written. A report exactly as it was proposed
 * is not a draft — it is what regenerating would produce anyway — and storing
 * one would mean a stale copy quietly standing in for a month the user has
 * since recorded more of.
 */

/** Where one month's draft in one language is kept. */
export function draftKey(month: Month, language: Language): string {
  return `job-tracker:report-draft:${month}:${language}`;
}

/**
 * What a stored draft has to look like to be read back. It is parsed rather
 * than trusted for the reason anything crossing a boundary is: browser storage
 * holds whatever an older version of this page put there, and a half-shaped
 * report would otherwise become a page that throws on render.
 *
 * It restates the report's shape, and the compiler is what keeps the two in
 * step: `draftFrom` below answers with an `ActivityReport`, so a field added
 * to a row and not added here makes that return a type error rather than a
 * draft that quietly comes back missing it.
 */
const StoredReport = z.object({
  month: z.string(),
  language: Language,
  rows: z.array(
    z.object({
      id: z.string(),
      employer: z.string(),
      link: z.string(),
      did: z.string(),
      back: z.string(),
    }),
  ),
  notes: z.string(),
});

/**
 * A stored draft as a report, or `null` where there is none to read — which is
 * also the answer for one that no longer parses, and for one filed under a
 * month or a language other than the one being asked for. A draft that does
 * not fit is dropped rather than repaired: the report behind it can always be
 * generated again, and there is nothing in a half-read document worth showing
 * somebody as their own words.
 */
export function draftFrom(
  stored: string | null,
  month: Month,
  language: Language,
): ActivityReport | null {
  if (stored === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return null;
  }

  const draft = StoredReport.safeParse(parsed);
  if (!draft.success) return null;
  if (draft.data.month !== month || draft.data.language !== language)
    return null;

  return draft.data;
}

/** A report as the string that comes back through `draftFrom`. */
export function writtenDraft(report: ActivityReport): string {
  return JSON.stringify(report);
}
