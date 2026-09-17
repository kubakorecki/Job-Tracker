import {
  JobStatus,
  type JobApplication,
  type SalaryPeriod,
} from "@repo/schema";
import { fitFractionOf } from "../coverage/compare";
import { fitRatio } from "../coverage/fit-ring";
import {
  salaryEquivalentOf,
  salaryRankOf,
} from "../job-applications/salary-equivalent";
import { silenceOf } from "../job-applications/silence";

/**
 * The order the dashboard shows its Job Applications in, once the filters have
 * had their say.
 *
 * This is arithmetic over a list, as `matching` in `filtering.ts` is: it runs
 * in the browser against the one cached list, so the board and the table are
 * handed the same order and can never disagree about it.
 */

/** The columns a Job Application can be put in order of. */
export const SORT_COLUMNS = [
  "company",
  "jobTitle",
  "location",
  "salary",
  "fit",
  "status",
  "silence",
  "closes",
  "excitement",
] as const;

export type SortColumn = (typeof SORT_COLUMNS)[number];

/** Smallest first, or largest first — A→Z is ascending, highest first descending. */
export type SortDirection = "ascending" | "descending";

/**
 * A column and a direction, or `null` for none: newest added, the order the
 * list already arrives in.
 */
export type DashboardSort = {
  column: SortColumn;
  direction: SortDirection;
} | null;

/**
 * The direction each column is first sorted in: the one a person pressing
 * that heading most likely wants. Names from A, and the pipeline from its
 * start; the most money, fit, silence and Excitement first; and the Closing
 * Date that comes soonest.
 */
export const NATURAL_DIRECTION: Record<SortColumn, SortDirection> = {
  company: "ascending",
  jobTitle: "ascending",
  location: "ascending",
  salary: "descending",
  fit: "descending",
  status: "ascending",
  silence: "descending",
  closes: "ascending",
  excitement: "descending",
};

/**
 * The sort after the user presses `column`'s heading: its natural direction,
 * then the other one, then none. A different column always starts afresh,
 * rather than inheriting a direction that meant something else over there.
 */
export function nextSort(
  current: DashboardSort,
  column: SortColumn,
): DashboardSort {
  const natural = NATURAL_DIRECTION[column];

  if (current === null || current.column !== column) {
    return { column, direction: natural };
  }
  if (current.direction === natural) {
    return { column, direction: reversed(natural) };
  }
  return null;
}

function reversed(direction: SortDirection): SortDirection {
  return direction === "ascending" ? "descending" : "ascending";
}

export const DASHBOARD_SORT_KEY = "job-tracker:dashboard-sort";

/** How a sort is written into browser storage: `salary:descending`, or `none`. */
export function storedSort(sort: DashboardSort): string {
  return sort === null ? "none" : `${sort.column}:${sort.direction}`;
}

/**
 * A stored value as a sort. Like `viewFrom`, it trusts nothing it did not
 * write: a column that has since been renamed, or a value some earlier version
 * of the dashboard left there, reads as newest added rather than as an error.
 */
export function sortFrom(stored: string | null): DashboardSort {
  const [column, direction, ...rest] = (stored ?? "").split(":");

  if (
    rest.length > 0 ||
    !SORT_COLUMNS.includes(column as SortColumn) ||
    (direction !== "ascending" && direction !== "descending")
  ) {
    return null;
  }

  return { column: column as SortColumn, direction };
}

/**
 * What ordering needs besides the list and the sort.
 *
 * `today` is an argument rather than the clock, for the reason it is one to
 * `matching`: silence is a count of days, and a function that read the clock
 * could not be tested at any point in the year.
 */
export type OrderingContext = {
  /**
   * Every Job Application the user has, before the filters narrowed it. The
   * salary sort reads its currency groups from here, so that narrowing the
   * view does not reshuffle them.
   */
  everything: readonly JobApplication[];
  /** The Salary Period salaries are being read in. */
  period: SalaryPeriod;
  today: string;
};

/**
 * `shown` in the order `sort` asks for, as a new list.
 *
 * Blanks go last whichever way the column runs, because an unknown is not a
 * low value: a salary nobody recorded is not the worst-paid job, and reversing
 * the sort must not make it the best-paid. Ties keep the order the list
 * arrived in — newest added — so a sort moves only what it has a reason to.
 */
export function ordered(
  shown: readonly JobApplication[],
  sort: DashboardSort,
  context: OrderingContext,
): JobApplication[] {
  if (sort === null) return [...shown];

  const rankOf = RANKINGS[sort.column](context);
  const sign = sort.direction === "ascending" ? 1 : -1;

  return shown
    .map((jobApplication) => ({ jobApplication, rank: rankOf(jobApplication) }))
    .sort((a, b) => {
      if (a.rank === null || b.rank === null) {
        return Number(a.rank === null) - Number(b.rank === null);
      }
      return a.rank.group - b.rank.group || sign * compared(a.rank, b.rank);
    })
    .map(({ jobApplication }) => jobApplication);
}

/**
 * Where a Job Application stands in a column's order, or `null` for a blank.
 *
 * `group` is compared first and never reversed; within a group, `value` runs
 * in the direction chosen. Only the salary sort has more than one group.
 */
type Rank = { group: number; value: number | string };

type Ranking = (
  context: OrderingContext,
) => (jobApplication: JobApplication) => Rank | null;

/**
 * Text compared as people read it: without regard to case, and with an
 * accented letter beside its plain one. A fixed locale rather than the
 * reader's, for the reason `day.ts` fixes one — the dashboard renders on the
 * server and again in the browser, and the two must agree on the order.
 */
const TEXT = new Intl.Collator("en-GB", { sensitivity: "base" });

function compared(a: Rank, b: Rank): number {
  if (typeof a.value === "string" && typeof b.value === "string") {
    return TEXT.compare(a.value, b.value);
  }
  return Number(a.value) - Number(b.value);
}

const text =
  (field: "company" | "jobTitle" | "location"): Ranking =>
  () =>
  (jobApplication) => {
    const value = jobApplication[field];
    return value === null ? null : { group: 0, value };
  };

/**
 * Salaries ranked apart by currency, because nothing here converts one into
 * another (no exchange rate is a fact about the Posting). The groups run from
 * the currency the user's salaries are most often quoted in to the least, with
 * a tie broken alphabetically and a salary with no currency after them all;
 * within a group, by the Salary Equivalent's ranking value in the period
 * salaries are being read in.
 *
 * The counts are taken over `everything`, so the group order is a fact about
 * the user's job hunt rather than about the filters: typing a company into the
 * search box must not promote EUR above PLN.
 */
function bySalary({ everything, period }: OrderingContext) {
  const counts = new Map<string, number>();
  for (const jobApplication of everything) {
    // Only a salary counts towards what salaries are quoted in: a currency
    // recorded beside no figure quotes nothing.
    const equivalent = salaryEquivalentOf(jobApplication, period);
    if (equivalent?.currency == null) continue;
    counts.set(equivalent.currency, (counts.get(equivalent.currency) ?? 0) + 1);
  }

  const currencies = [...counts]
    .sort(([a, aCount], [b, bCount]) => bCount - aCount || TEXT.compare(a, b))
    .map(([currency]) => currency);

  return (jobApplication: JobApplication): Rank | null => {
    const equivalent = salaryEquivalentOf(jobApplication, period);
    if (equivalent === null) return null;

    // A currency `everything` does not hold — a caller that passed less than
    // the whole list — goes after the counted ones rather than above them.
    const counted =
      equivalent.currency === null
        ? -1
        : currencies.indexOf(equivalent.currency);

    return {
      group:
        equivalent.currency === null
          ? currencies.length + 1
          : counted === -1
            ? currencies.length
            : counted,
      value: salaryRankOf(equivalent),
    };
  };
}

/** A number, where there is one, in the one group every column but salary has. */
const numbered = (value: number | null): Rank | null =>
  value === null ? null : { group: 0, value };

const RANKINGS: Record<SortColumn, Ranking> = {
  company: text("company"),
  jobTitle: text("jobTitle"),
  location: text("location"),
  salary: bySalary,
  // By the ratio rather than the count: 3/4 is a better fit than 4/8.
  fit: () => (jobApplication) => {
    const fraction = fitFractionOf(jobApplication.requirements);
    return numbered(fraction === null ? null : fitRatio(fraction));
  },
  // The pipeline's own order, as the board lays its columns out.
  status: () => (jobApplication) =>
    numbered(JobStatus.options.indexOf(jobApplication.status)),
  // No silence — nobody being waited on, or not for a week yet — is a blank
  // rather than a silence of nought days, and goes last with the other blanks.
  silence:
    ({ today }) =>
    (jobApplication) =>
      numbered(silenceOf(jobApplication, today)?.days ?? null),
  // A plain date order, whatever the Status: a bookmark whose Posting has
  // closed rises to the top, which is the nudge to withdraw it.
  closes: () => (jobApplication) =>
    numbered(
      jobApplication.closesOn === null
        ? null
        : Date.parse(jobApplication.closesOn),
    ),
  // Nobody having rated it is not a rating of nought.
  excitement: () => (jobApplication) => numbered(jobApplication.excitement),
};
