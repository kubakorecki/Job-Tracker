import type { JobApplication, SalaryPeriod } from "@repo/schema";
import type { ReactNode } from "react";
import {
  salaryDescription,
  salaryEquivalentOf,
  salaryLabel,
} from "../../lib/job-applications/salary-equivalent";

/**
 * A Job Application's salary in the short form, restated over the Salary
 * Period the user reads salaries in: `≈ 17–26.1k PLN / mo`.
 *
 * One component for the table cell and the board card, for the reason there is
 * one fit ring: a salary that read one way on a card and another in the row
 * would be a reason to trust neither.
 *
 * The `≈` is drawn only where the arithmetic changed the figure, and it is what
 * the hover text hangs off: the salary as the Posting stated it, and the
 * working year it was restated on. The same sentence is in the page for a
 * screen reader, since a `title` is out of reach of anyone without a pointer —
 * and on a card, which is itself a link, there is nothing else inside it that
 * could take focus to show one.
 */
export function SalaryFigure({
  salary,
  period,
  unrecorded = null,
}: {
  salary: Pick<
    JobApplication,
    "salaryMin" | "salaryMax" | "salaryPeriod" | "currency"
  >;
  period: SalaryPeriod;
  /**
   * What to render where no salary is recorded. Nothing, by default, so a card
   * without one does not grow a line of dashes; the table passes the dash
   * Location uses, as it does for an unrecorded Closing Date.
   */
  unrecorded?: ReactNode;
}) {
  const equivalent = salaryEquivalentOf(salary, period);

  if (equivalent === null) return unrecorded;

  if (!equivalent.approximate) return <>{salaryLabel(equivalent)}</>;

  const description = salaryDescription(equivalent);

  return (
    <>
      <span aria-hidden="true" className="cursor-help" title={description}>
        ≈
      </span>{" "}
      {salaryLabel(equivalent)}
      <span className="sr-only"> ({description})</span>
    </>
  );
}
