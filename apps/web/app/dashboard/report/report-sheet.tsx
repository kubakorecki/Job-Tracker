"use client";

import type { Cell } from "../../../lib/activity-report/edits";
import { linkHref, shortLink } from "../../../lib/activity-report/link";
import type {
  ActivityReport,
  ReportRow,
} from "../../../lib/activity-report/report";
import {
  fullDayInWords,
  monthInWords,
  WORDING,
  type Wording,
} from "../../../lib/activity-report/wording";
import {
  ICON_BUTTON,
  QUIET_BOX,
  SECONDARY_BUTTON_SMALL,
  TEXTAREA_ON_RAISED,
} from "../../form";

/**
 * The document itself: the header the office reads first, the three-column
 * table, and the free block under it.
 *
 * Every cell is two things at once — a box on screen and a line of text on
 * paper — and that is deliberate. A textarea is a piece of this application's
 * interface, and nothing of the application's interface prints: a printed
 * textarea carries its own border and its own scrollbar, and clips whatever
 * did not fit the height it happened to have. So each cell renders the control
 * for the screen and the words for the sheet, and the print stylesheet in
 * `app/globals.css` decides which of the two a reader is looking at.
 *
 * It is the same arrangement that keeps the Posting's address a real link. The
 * screen gets a box holding the whole URL, because a link the user cannot see
 * is a link they cannot correct; the sheet gets an anchor whose words are the
 * shortened form and whose `href` is the address itself, which is what Chrome
 * turns into a live annotation in the PDF.
 */
export function ReportSheet({
  report,
  name,
  today,
  onCell,
  onNotes,
  onAddRow,
  onRemoveRow,
  onName,
}: {
  report: ActivityReport;
  /** The user's own name, which is remembered rather than part of the report. */
  name: string;
  /** The day the sheet is being drawn up, in the reader's own zone. */
  today: string;
  onCell: (id: string, cell: Cell, text: string) => void;
  onNotes: (notes: string) => void;
  onAddRow: () => void;
  onRemoveRow: (id: string) => void;
  onName: (name: string) => void;
}) {
  const words = WORDING[report.language];

  return (
    <article className="sheet rounded-panel border border-line bg-paper-raised p-[22px] print:rounded-none print:border-0 print:bg-transparent print:p-0">
      <header className="mb-4 flex flex-col gap-2.5 print:mb-3">
        {/* The document's own title, under the page's. It is an h2 on screen,
            where the page heading above it is the h1; printed, it is the first
            thing on the sheet and the only heading over the table. */}
        <h2 className="type-section print:text-[13pt]">{words.title}</h2>

        <dl className="flex flex-wrap items-baseline gap-x-7 gap-y-1.5 text-[12.5px] text-ink-muted print:gap-x-5 print:text-[9.5pt]">
          <Stated label={words.month}>
            {monthInWords(report.month, report.language)}
          </Stated>

          <Stated label={words.name}>
            {/* The one field of the document that is not part of the report:
                it is the same name every month, so it is remembered rather
                than regenerated. */}
            <input
              aria-label={words.name}
              className={`${QUIET_BOX} w-[220px] print:hidden`}
              onChange={(event) => onName(event.target.value)}
              placeholder={words.namePlaceholder}
              value={name}
            />
            <span className="hidden print:inline">{name}</span>
          </Stated>

          <Stated label={words.preparedOn}>
            {fullDayInWords(today, report.language)}
          </Stated>
        </dl>
      </header>

      <table className="w-full border-collapse text-left">
        <colgroup>
          <col className="w-[42%]" />
          <col className="w-[29%]" />
          <col className="w-[29%]" />
        </colgroup>
        <thead>
          <tr>
            {words.columns.map((column) => (
              <th
                className="type-eyebrow border border-line-strong bg-paper-sunk px-2.5 py-2 text-ink-muted print:bg-transparent"
                key={column}
                scope="col"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <Row
              key={row.id}
              onCell={onCell}
              onRemove={() => onRemoveRow(row.id)}
              row={row}
              words={words}
            />
          ))}
        </tbody>
      </table>

      {/* Under the table, where a row would go next, and off the sheet
          entirely once it is printed. */}
      <div className="mt-3 print:hidden">
        <button
          className={SECONDARY_BUTTON_SMALL}
          onClick={onAddRow}
          type="button"
        >
          Add a row
        </button>
      </div>

      <section className="mt-5 print:mt-4">
        <h3 className="type-eyebrow mb-2 text-ink-muted print:hidden">
          {words.notes}
        </h3>
        <textarea
          aria-label={words.notes}
          className={`${TEXTAREA_ON_RAISED} print:hidden`}
          onChange={(event) => onNotes(event.target.value)}
          rows={3}
          value={report.notes}
        />

        {/* It prints only when it says something: an empty heading over an
            empty box is the office being told there is something to read. */}
        {report.notes.trim() !== "" && (
          <div className="hidden print:block">
            <h3 className="mb-1 text-[9pt] font-semibold">{words.notes}</h3>
            <p className="text-[9.5pt] whitespace-pre-line">{report.notes}</p>
          </div>
        )}
      </section>
    </article>
  );
}

/** One line of the header: what it is, and what it says. */
function Stated({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-ink-faint">{label}:</dt>
      <dd className="flex items-baseline gap-2 font-medium text-ink">
        {children}
      </dd>
    </div>
  );
}

/** One contact: the employer, what the user did, and what came back. */
function Row({
  row,
  words,
  onCell,
  onRemove,
}: {
  row: ReportRow;
  words: Wording;
  onCell: (id: string, cell: Cell, text: string) => void;
  onRemove: () => void;
}) {
  const href = linkHref(row.link);

  return (
    <tr>
      <td className="border border-line-strong p-1.5 align-top">
        <div className="flex items-start gap-1">
          <Editable
            label={words.columns[0]}
            onChange={(text) => onCell(row.id, "employer", text)}
            value={row.employer}
          />
          {/* No confirmation: a report is a draft of a document rather than a
              record of anything, and "Generate again" puts back any row this
              took away. */}
          <button
            aria-label="Remove this row"
            className={`${ICON_BUTTON} print:hidden`}
            onClick={onRemove}
            type="button"
          >
            <Cross />
          </button>
        </div>

        <input
          aria-label="Link to the Posting"
          className={`${QUIET_BOX} w-full text-[11.5px] text-ink-faint print:hidden`}
          onChange={(event) => onCell(row.id, "link", event.target.value)}
          placeholder="https://"
          value={row.link}
        />

        {row.link.trim() !== "" && (
          <div className="hidden print:block">
            {href === null ? (
              shortLink(row.link)
            ) : (
              <a href={href}>{shortLink(row.link)}</a>
            )}
          </div>
        )}
      </td>

      <td className="border border-line-strong p-1.5 align-top">
        <Editable
          label={words.columns[1]}
          onChange={(text) => onCell(row.id, "did", text)}
          value={row.did}
        />
      </td>

      <td className="border border-line-strong p-1.5 align-top">
        <Editable
          label={words.columns[2]}
          onChange={(text) => onCell(row.id, "back", text)}
          value={row.back}
        />
      </td>
    </tr>
  );
}

/**
 * A cell: a box that grows with what is typed into it on screen, and the words
 * themselves on paper.
 *
 * The box is sized from the lines it holds rather than measured after the
 * fact. A textarea cannot size itself to its content, and the alternative — a
 * layout effect reading `scrollHeight` on every keystroke — is a great deal of
 * machinery for a document whose cells are three lines long.
 */
function Editable({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (text: string) => void;
}) {
  return (
    <>
      <textarea
        aria-label={label}
        className={`${QUIET_BOX} w-full resize-none text-[12.5px] leading-[1.45] print:hidden`}
        onChange={(event) => onChange(event.target.value)}
        rows={Math.max(2, value.split("\n").length)}
        value={value}
      />
      <div className="hidden whitespace-pre-line print:block">{value}</div>
    </>
  );
}

/** Taking a row off the sheet. 24px grid, 1.7px stroke, no fill. */
function Cross() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      width="14"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
