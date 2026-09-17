import {
  NATURAL_DIRECTION,
  nextSort,
  reversed,
  SORT_COLUMNS,
  type DashboardSort,
  type SortColumn,
  type SortDirection,
} from "./sorting";

/**
 * What the dashboard says about its order: the table's headings, as a screen
 * reader hears them, and the board's dropdown. Kept apart from `sorting.ts`,
 * which is the arithmetic, so the two can change for their own reasons.
 */

/** Each column's name, as the table heads it. */
export const SORT_COLUMN_LABELS: Record<SortColumn, string> = {
  company: "Company",
  jobTitle: "Job title",
  location: "Location",
  salary: "Salary",
  fit: "Fit",
  status: "Status",
  silence: "Silence",
  closes: "Closes",
  excitement: "Excitement",
};

/**
 * Each direction in the column's own terms, since "ascending" means nothing to
 * a person reading a salary: the most money first is what they asked for.
 */
const DIRECTION_WORDS: Record<SortColumn, Record<SortDirection, string>> = {
  company: { ascending: "A to Z", descending: "Z to A" },
  jobTitle: { ascending: "A to Z", descending: "Z to A" },
  location: { ascending: "A to Z", descending: "Z to A" },
  salary: { ascending: "lowest first", descending: "highest first" },
  fit: { ascending: "lowest first", descending: "highest first" },
  status: { ascending: "pipeline order", descending: "pipeline reversed" },
  silence: { ascending: "fewest days first", descending: "most days first" },
  closes: { ascending: "earliest first", descending: "latest first" },
  excitement: { ascending: "lowest first", descending: "highest first" },
};

/** A sort in words: `Salary, highest first`. */
export function sortLabel(
  column: SortColumn,
  direction: SortDirection,
): string {
  return `${SORT_COLUMN_LABELS[column]}, ${DIRECTION_WORDS[column][direction]}`;
}

/**
 * A heading button's accessible name: what pressing it will do, rather than
 * what the column is sorted by now — the arrow and `aria-sort` already say
 * that, and a button is named for its action.
 */
export function headingAction(
  current: DashboardSort,
  column: SortColumn,
): string {
  const next = nextSort(current, column);

  return next === null
    ? `Stop sorting by ${SORT_COLUMN_LABELS[column]}, back to newest added`
    : `Sort by ${sortLabel(next.column, next.direction)}`;
}

/**
 * The `aria-sort` a heading carries: the direction on the one column the table
 * is sorted by, and nothing on the rest, so a screen reader announces the
 * order once rather than eight headings of "not sorted".
 */
export function ariaSortOf(
  sort: DashboardSort,
  column: SortColumn,
): SortDirection | undefined {
  return sort?.column === column ? sort.direction : undefined;
}

/**
 * The columns the board can be sorted by. Status is not one: the board's columns are
 * the Status already, so ordering the cards inside one by it moves nothing.
 */
export const BOARD_SORT_COLUMNS: readonly SortColumn[] = SORT_COLUMNS.filter(
  (column) => column !== "status",
);

/**
 * The sort as the board reads it: the one the table left, unless that was on
 * Status, which reads as newest added — the order the board's columns are in
 * without one.
 */
export function boardSortOf(sort: DashboardSort): DashboardSort {
  return sort !== null && BOARD_SORT_COLUMNS.includes(sort.column)
    ? sort
    : null;
}

/**
 * The board's dropdown: newest added, then each column the board can sort by,
 * its natural direction before the other — the same order a heading's clicks
 * run through.
 */
export const BOARD_SORT_OPTIONS: readonly {
  sort: DashboardSort;
  label: string;
}[] = [
  { sort: null, label: "Newest added" },
  ...BOARD_SORT_COLUMNS.flatMap((column) => {
    const natural = NATURAL_DIRECTION[column];

    return [natural, reversed(natural)].map((direction) => ({
      sort: { column, direction },
      label: sortLabel(column, direction),
    }));
  }),
];
