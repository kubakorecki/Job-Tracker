import type { ActivityReport, ReportRow } from "./report";

/**
 * What the user does to a proposed report: reword a cell, add a row the record
 * knows nothing about, take one out, and write under the table.
 *
 * Every one of them answers with a new report rather than changing the one it
 * was given, because the page holds the report in state and compares it with
 * what the generator would propose to know whether anything has been typed.
 *
 * There is no reordering here and there is not meant to be. The rows are in
 * the order the month happened, which is the order the office reads them in,
 * and a row the user added goes last — it is the one row that has no day of
 * its own to be placed by.
 */

/** Which of the four editable pieces of a row is being changed. */
export type Cell = "employer" | "link" | "did" | "back";

/** The same report with one cell reworded. */
export function withCell(
  report: ActivityReport,
  id: string,
  cell: Cell,
  text: string,
): ActivityReport {
  return {
    ...report,
    rows: report.rows.map((row) =>
      row.id === id ? { ...row, [cell]: text } : row,
    ),
  };
}

/** The same report with the free block under the table rewritten. */
export function withNotes(
  report: ActivityReport,
  notes: string,
): ActivityReport {
  return { ...report, notes };
}

/**
 * The same report with an empty row on the end.
 *
 * The id is the caller's to make, so this stays arithmetic: the page hands it
 * `crypto.randomUUID()`, and a test hands it something it can name. A row the
 * user added has no Job Application behind it — a contact the tracker never
 * heard of is exactly what it is for — so nothing can be proposed for it and
 * an id is all it needs.
 */
export function withRowAdded(
  report: ActivityReport,
  id: string,
): ActivityReport {
  return { ...report, rows: [...report.rows, blankRow(id)] };
}

/** The same report with one row gone. */
export function withoutRow(report: ActivityReport, id: string): ActivityReport {
  return { ...report, rows: report.rows.filter((row) => row.id !== id) };
}

/** An empty row, which is what the user gets to type into. */
export function blankRow(id: string): ReportRow {
  return { id, employer: "", link: "", did: "", back: "" };
}

/**
 * Whether two reports say the same thing — which is how the page knows there
 * is something to lose before it generates over a draft.
 *
 * The month and the language are not compared: two reports are only ever put
 * side by side here when they are of the same month in the same language, and
 * comparing them would make this read as a general equality it is not.
 */
export function sameReport(
  one: ActivityReport,
  other: ActivityReport,
): boolean {
  if (one.notes !== other.notes) return false;
  if (one.rows.length !== other.rows.length) return false;

  return one.rows.every((row, at) => sameRow(row, other.rows[at]!));
}

function sameRow(one: ReportRow, other: ReportRow): boolean {
  return (
    one.id === other.id &&
    one.employer === other.employer &&
    one.link === other.link &&
    one.did === other.did &&
    one.back === other.back
  );
}
