import type { JobApplication, SalaryPeriod } from "@repo/schema";
import { describe, expect, it } from "vitest";
import {
  salaryDescription,
  salaryEquivalentOf,
  salaryLabel,
  salaryRankOf,
  type SalaryEquivalent,
} from "./salary-equivalent";

/**
 * A recorded salary restated over the period the user reads salaries in. Every
 * expected figure below is worked out by hand on the fixed working year — 12
 * months, 260 days, 2080 hours — rather than by multiplying in the test, so a
 * wrong factor in the module cannot be copied into the assertion.
 */

type Salary = Pick<
  JobApplication,
  "salaryMin" | "salaryMax" | "salaryPeriod" | "currency"
>;

const salary = (
  salaryMin: number | null,
  salaryMax: number | null,
  salaryPeriod: SalaryPeriod | null,
  currency: string | null = "PLN",
): Salary => ({ salaryMin, salaryMax, salaryPeriod, currency });

/** A Salary Equivalent for a salary the test knows is there. */
const equivalent = (stated: Salary, period: SalaryPeriod): SalaryEquivalent => {
  const found = salaryEquivalentOf(stated, period);
  if (found === null) throw new Error("expected a Salary Equivalent");
  return found;
};

describe("salaryEquivalentOf", () => {
  it("leaves a salary read in the period it was stated in exactly as stated", () => {
    expect(
      salaryEquivalentOf(salary(17000, 26090, "monthly"), "monthly"),
    ).toEqual({
      min: 17000,
      max: 26090,
      period: "monthly",
      currency: "PLN",
      approximate: false,
      stated: { min: 17000, max: 26090, period: "monthly" },
    });
  });

  it.each(["annual", "monthly", "daily", "hourly"] as const)(
    "leaves a salary stated and read %s untouched, and not approximate",
    (period) => {
      const same = salaryEquivalentOf(salary(1234.5, 6789, period), period);

      expect([same?.min, same?.max, same?.approximate]).toEqual([
        1234.5,
        6789,
        false,
      ]);
    },
  );

  // Each row is one stated salary read in another period, worked on paper:
  // a year is 12 months, 260 days or 2080 hours.
  it.each([
    ["hourly", 150, "monthly", 26000],
    ["hourly", 150, "annual", 312000],
    ["hourly", 150, "daily", 1200],
    ["daily", 400, "hourly", 50],
    ["daily", 1200, "monthly", 26000],
    ["daily", 1200, "annual", 312000],
    ["monthly", 26000, "annual", 312000],
    ["monthly", 26000, "daily", 1200],
    ["monthly", 26000, "hourly", 150],
    ["annual", 312000, "monthly", 26000],
    ["annual", 312000, "daily", 1200],
    ["annual", 312000, "hourly", 150],
  ] as const)(
    "restates %s %d as %s %d, and says the figure is approximate",
    (stated, figure, chosen, expected) => {
      const restated = salaryEquivalentOf(
        salary(figure, figure, stated),
        chosen,
      );

      expect(restated?.min).toBeCloseTo(expected);
      expect(restated?.max).toBeCloseTo(expected);
      expect(restated?.period).toBe(chosen);
      expect(restated?.approximate).toBe(true);
      expect(restated?.stated).toEqual({
        min: figure,
        max: figure,
        period: stated,
      });
    },
  );

  it("has no Salary Equivalent where no salary is recorded, rather than one of nothing", () => {
    expect(
      salaryEquivalentOf(salary(null, null, null, null), "monthly"),
    ).toBeNull();
    expect(
      salaryEquivalentOf(salary(null, null, "monthly"), "monthly"),
    ).toBeNull();
  });

  it("has no Salary Equivalent for a figure recorded without a period, which means nothing on its own", () => {
    expect(
      salaryEquivalentOf(salary(17000, 26090, null), "monthly"),
    ).toBeNull();
  });

  it("restates the one bound a salary has and leaves the other empty", () => {
    const from = salaryEquivalentOf(salary(26000, null, "monthly"), "annual");
    const upTo = salaryEquivalentOf(salary(null, 26000, "monthly"), "annual");

    expect([from?.min, from?.max]).toEqual([312000, null]);
    expect([upTo?.min, upTo?.max]).toEqual([null, 312000]);
  });

  it("carries the currency along untouched, and no currency as none", () => {
    expect(
      salaryEquivalentOf(salary(55000, 70000, "annual", "GBP"), "monthly")
        ?.currency,
    ).toBe("GBP");
    expect(
      salaryEquivalentOf(salary(55000, 70000, "annual", null), "monthly")
        ?.currency,
    ).toBeNull();
  });

  it("keeps a figure that does not divide evenly unrounded, leaving rounding to the label", () => {
    expect(
      salaryEquivalentOf(salary(55000, null, "annual"), "daily")?.min,
    ).toBeCloseTo(211.538, 3);
  });
});

describe("salaryRankOf", () => {
  it("ranks a range by its middle", () => {
    expect(
      salaryRankOf(equivalent(salary(17000, 26090, "monthly"), "monthly")),
    ).toBe(21545);
  });

  it("ranks by the middle of the restated range, not the stated one", () => {
    // 150–180 an hour is 26 000–31 200 a month.
    expect(
      salaryRankOf(equivalent(salary(150, 180, "hourly"), "monthly")),
    ).toBeCloseTo(28600);
  });

  it("ranks a salary with one bound by that bound", () => {
    expect(
      salaryRankOf(equivalent(salary(17000, null, "monthly"), "monthly")),
    ).toBe(17000);
    expect(
      salaryRankOf(equivalent(salary(null, 26090, "monthly"), "monthly")),
    ).toBe(26090);
  });
});

describe("salaryLabel", () => {
  it("writes a range in thousands with one k and at most one decimal", () => {
    expect(
      salaryLabel(equivalent(salary(17000, 26090, "monthly"), "monthly")),
    ).toBe("17–26.1k PLN / mo");
  });

  it("writes figures below ten thousand as whole numbers", () => {
    expect(salaryLabel(equivalent(salary(150, 180, "hourly"), "hourly"))).toBe(
      "150–180 PLN / h",
    );
    // 55 000 a year is 211.54 a day.
    expect(
      salaryLabel(equivalent(salary(55000, null, "annual", "GBP"), "daily")),
    ).toBe("from 212 GBP / day");
  });

  it("gives each bound its own form where the range crosses ten thousand", () => {
    expect(
      salaryLabel(equivalent(salary(9999, 10000, "monthly"), "monthly")),
    ).toBe("9999–10k PLN / mo");
  });

  it("decides between the forms after rounding, so nothing reads as 10000", () => {
    expect(
      salaryLabel(equivalent(salary(9999.6, null, "monthly"), "monthly")),
    ).toBe("from 10k PLN / mo");
    expect(
      salaryLabel(equivalent(salary(null, 99960, "annual"), "annual")),
    ).toBe("up to 100k PLN / yr");
  });

  it("writes a single bound as from or up to", () => {
    expect(
      salaryLabel(equivalent(salary(17000, null, "monthly"), "monthly")),
    ).toBe("from 17k PLN / mo");
    expect(
      salaryLabel(equivalent(salary(null, 26090, "monthly"), "monthly")),
    ).toBe("up to 26.1k PLN / mo");
  });

  it("writes a range whose bounds read the same as one figure", () => {
    expect(
      salaryLabel(equivalent(salary(26010, 26040, "monthly"), "monthly")),
    ).toBe("26k PLN / mo");
  });

  it("leaves the currency out where none is recorded", () => {
    expect(
      salaryLabel(equivalent(salary(17000, 26000, "monthly", null), "monthly")),
    ).toBe("17–26k / mo");
  });

  it("names every period by its short suffix", () => {
    // 312 000 a year: 26 000 a month, 1200 a day, 150 an hour.
    const read = (period: SalaryPeriod) =>
      salaryLabel(equivalent(salary(312000, null, "annual"), period));

    expect(read("annual")).toBe("from 312k PLN / yr");
    expect(read("monthly")).toBe("from 26k PLN / mo");
    expect(read("daily")).toBe("from 1200 PLN / day");
    expect(read("hourly")).toBe("from 150 PLN / h");
  });
});

describe("salaryDescription", () => {
  it("names the salary as the Posting stated it, in full, and the working year the figure was restated on", () => {
    expect(
      salaryDescription(equivalent(salary(150, 180, "hourly"), "monthly")),
    ).toBe(
      "Stated as 150–180 PLN per hour · restated on a year of 12 months, 260 days, 2080 hours",
    );
  });

  it("names a single bound and a missing currency the way the Posting left them", () => {
    expect(
      salaryDescription(
        equivalent(salary(55000, null, "annual", null), "daily"),
      ),
    ).toBe(
      "Stated as from 55000 per year · restated on a year of 12 months, 260 days, 2080 hours",
    );
  });

  it("names no working year where nothing was restated", () => {
    expect(
      salaryDescription(equivalent(salary(17000, 26090, "monthly"), "monthly")),
    ).toBe("Stated as 17000–26090 PLN per month");
  });
});
