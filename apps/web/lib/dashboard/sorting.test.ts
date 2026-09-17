import type { JobApplication } from "@repo/schema";
import { describe, expect, it } from "vitest";
import { asked } from "../test-support/requirements";
import {
  nextSort,
  ordered,
  sortFrom,
  storedSort,
  type DashboardSort,
} from "./sorting";

/** Every case is read against a fixed day, so a silence never moves under it. */
const TODAY = "2026-09-06";

let added = 0;

/**
 * A Job Application with nothing recorded but what the case is about. Each
 * one is added a day after the last, so a list built in reverse order of
 * creation is newest added — the order the dashboard receives it in.
 */
const aJobApplication = (fields: Partial<JobApplication>): JobApplication => {
  added += 1;
  const createdAt = new Date(Date.UTC(2026, 0, added)).toISOString();

  return {
    id: String(added),
    userId: "00000000-0000-4000-8000-000000000001",
    company: "Basecamp",
    jobTitle: "Programmer",
    jobUrl: null,
    location: null,
    remoteType: null,
    salaryMin: null,
    salaryMax: null,
    salaryPeriod: null,
    closesOn: null,
    currency: null,
    description: null,
    requirements: [],
    status: "bookmarked",
    source: null,
    appliedAt: null,
    excitement: null,
    notes: null,
    createdAt,
    updatedAt: createdAt,
    ...fields,
  };
};

/** Ordered with the list itself standing in for everything the user has. */
const order = (
  jobApplications: JobApplication[],
  sort: DashboardSort,
): string[] =>
  ordered(jobApplications, sort, {
    everything: jobApplications,
    period: "monthly",
    today: TODAY,
  }).map(({ id }) => id);

const ids = (...jobApplications: JobApplication[]): string[] =>
  jobApplications.map(({ id }) => id);

describe("ordered, with no sort", () => {
  it("leaves the list in the order it arrived: newest added", () => {
    const older = aJobApplication({ company: "Zapier" });
    const newer = aJobApplication({ company: "Asana" });

    expect(order([newer, older], null)).toEqual(ids(newer, older));
  });
});

describe("ordered by a text column", () => {
  const stripe = aJobApplication({ company: "stripe", jobTitle: "Designer" });
  const asana = aJobApplication({ company: "Asana", jobTitle: "engineer" });
  const zapier = aJobApplication({ company: "Zapier", jobTitle: "Analyst" });
  const newestFirst = [zapier, asana, stripe];

  it("puts companies A to Z, whatever their case", () => {
    expect(
      order(newestFirst, { column: "company", direction: "ascending" }),
    ).toEqual(ids(asana, stripe, zapier));
  });

  it("puts companies Z to A reversed", () => {
    expect(
      order(newestFirst, { column: "company", direction: "descending" }),
    ).toEqual(ids(zapier, stripe, asana));
  });

  it("puts job titles A to Z and back", () => {
    expect(
      order(newestFirst, { column: "jobTitle", direction: "ascending" }),
    ).toEqual(ids(zapier, stripe, asana));
    expect(
      order(newestFirst, { column: "jobTitle", direction: "descending" }),
    ).toEqual(ids(asana, stripe, zapier));
  });

  it("compares as the locale does, so an accented letter sits beside its own", () => {
    const zeta = aJobApplication({ company: "Zeta" });
    const eclair = aJobApplication({ company: "Éclair" });
    const fable = aJobApplication({ company: "Fable" });

    expect(
      order([zeta, fable, eclair], {
        column: "company",
        direction: "ascending",
      }),
    ).toEqual(ids(eclair, fable, zeta));
  });

  it("keeps newest added among companies that tie, in both directions", () => {
    const olderAcme = aJobApplication({ company: "Acme" });
    const bolt = aJobApplication({ company: "Bolt" });
    const newerAcme = aJobApplication({ company: "ACME" });
    const newest = [newerAcme, bolt, olderAcme];

    expect(
      order(newest, { column: "company", direction: "ascending" }),
    ).toEqual(ids(newerAcme, olderAcme, bolt));
    expect(
      order(newest, { column: "company", direction: "descending" }),
    ).toEqual(ids(bolt, newerAcme, olderAcme));
  });

  it("puts a Job Application with no Location last, in both directions", () => {
    const nowhere = aJobApplication({ location: null });
    const warsaw = aJobApplication({ location: "Warsaw" });
    const berlin = aJobApplication({ location: "berlin" });
    const newest = [berlin, warsaw, nowhere];

    expect(
      order(newest, { column: "location", direction: "ascending" }),
    ).toEqual(ids(berlin, warsaw, nowhere));
    expect(
      order(newest, { column: "location", direction: "descending" }),
    ).toEqual(ids(warsaw, berlin, nowhere));
  });
});

/** A Job Application nobody has heard back on for `days` days. */
const waitingFor = (days: number): Partial<JobApplication> => ({
  status: "applied",
  updatedAt: new Date(
    Date.parse(`${TODAY}T00:00:00.000Z`) - days * 24 * 60 * 60 * 1000,
  ).toISOString(),
});

/** A Posting insisting on `required` skills, of which the user has `have`. */
const fitOf = (have: number, required: number): Partial<JobApplication> => ({
  requirements: Array.from({ length: required }, (_, index) =>
    asked(`skill ${index}`, "required", {
      coverage: index < have ? "have" : "missing",
      overriddenCoverage: index < have ? "have" : "missing",
    }),
  ),
});

describe("ordered by Status", () => {
  it("follows the pipeline from bookmarked to withdrawn, and back", () => {
    const withdrawn = aJobApplication({ status: "withdrawn" });
    const bookmarked = aJobApplication({ status: "bookmarked" });
    const offer = aJobApplication({ status: "offer" });
    const applied = aJobApplication({ status: "applied" });
    const newest = [applied, offer, bookmarked, withdrawn];

    expect(order(newest, { column: "status", direction: "ascending" })).toEqual(
      ids(bookmarked, applied, offer, withdrawn),
    );
    expect(
      order(newest, { column: "status", direction: "descending" }),
    ).toEqual(ids(withdrawn, offer, applied, bookmarked));
  });
});

describe("ordered by Fit", () => {
  const unread = aJobApplication({ requirements: [] });
  const half = aJobApplication(fitOf(4, 8));
  const most = aJobApplication(fitOf(3, 4));
  const little = aJobApplication(fitOf(1, 10));
  const newest = [little, most, half, unread];

  it("puts the highest Fit Fraction first, by its ratio rather than its count", () => {
    expect(order(newest, { column: "fit", direction: "descending" })).toEqual(
      ids(most, half, little, unread),
    );
  });

  it("puts the lowest first reversed, and no Fit Fraction still last", () => {
    expect(order(newest, { column: "fit", direction: "ascending" })).toEqual(
      ids(little, half, most, unread),
    );
  });
});

describe("ordered by Silence", () => {
  const fresh = aJobApplication(waitingFor(2));
  const ghosted = aJobApplication(waitingFor(60));
  const quiet = aJobApplication(waitingFor(10));
  const bookmarked = aJobApplication({ status: "bookmarked" });
  const newest = [bookmarked, quiet, ghosted, fresh];

  it("puts the most days first, and no silence last", () => {
    expect(
      order(newest, { column: "silence", direction: "descending" }),
    ).toEqual(ids(ghosted, quiet, bookmarked, fresh));
  });

  it("puts the fewest days first reversed, and no silence still last", () => {
    expect(
      order(newest, { column: "silence", direction: "ascending" }),
    ).toEqual(ids(quiet, ghosted, bookmarked, fresh));
  });
});

describe("ordered by Closes", () => {
  const later = aJobApplication({ closesOn: "2026-10-30" });
  const none = aJobApplication({ closesOn: null });
  const passedButApplied = aJobApplication({
    closesOn: "2026-08-01",
    status: "applied",
  });
  const soon = aJobApplication({ closesOn: "2026-09-10" });
  const newest = [soon, passedButApplied, none, later];

  it("puts the earliest date first, a passed one on an applied Job Application included", () => {
    expect(order(newest, { column: "closes", direction: "ascending" })).toEqual(
      ids(passedButApplied, soon, later, none),
    );
  });

  it("puts the latest date first reversed, and no Closing Date still last", () => {
    expect(
      order(newest, { column: "closes", direction: "descending" }),
    ).toEqual(ids(later, soon, passedButApplied, none));
  });
});

describe("ordered by Excitement", () => {
  const unrated = aJobApplication({ excitement: null });
  const keen = aJobApplication({ excitement: 5 });
  const meh = aJobApplication({ excitement: 1 });
  const alsoKeen = aJobApplication({ excitement: 5 });
  const newest = [alsoKeen, meh, keen, unrated];

  it("puts the highest first, keeping newest added among equals", () => {
    expect(
      order(newest, { column: "excitement", direction: "descending" }),
    ).toEqual(ids(alsoKeen, keen, meh, unrated));
  });

  it("puts the lowest first reversed, and an unrated one still last", () => {
    expect(
      order(newest, { column: "excitement", direction: "ascending" }),
    ).toEqual(ids(meh, alsoKeen, keen, unrated));
  });
});

/** A salary as the Posting stated it. */
const paying = (
  salaryMin: number | null,
  salaryMax: number | null,
  salaryPeriod: JobApplication["salaryPeriod"],
  currency: string | null,
): Partial<JobApplication> => ({
  salaryMin,
  salaryMax,
  salaryPeriod,
  currency,
});

describe("ordered by salary, in one currency", () => {
  // 150 PLN an hour is 26 000 a month; the middle of 17–26k is 21.5k.
  const hourly = aJobApplication(paying(150, 150, "hourly", "PLN"));
  const none = aJobApplication(paying(null, null, null, null));
  const range = aJobApplication(paying(17_000, 26_000, "monthly", "PLN"));
  const fromOnly = aJobApplication(paying(24_000, null, "monthly", "PLN"));
  const newest = [fromOnly, range, none, hourly];

  it("puts the highest first, ranked by the middle of each range in the chosen period", () => {
    expect(
      order(newest, { column: "salary", direction: "descending" }),
    ).toEqual(ids(hourly, fromOnly, range, none));
  });

  it("puts the lowest first reversed, and no salary still last", () => {
    expect(order(newest, { column: "salary", direction: "ascending" })).toEqual(
      ids(range, fromOnly, hourly, none),
    );
  });
});

describe("ordered by salary, across currencies", () => {
  const eurHigh = aJobApplication(paying(9_000, null, "monthly", "EUR"));
  const plnLow = aJobApplication(paying(10_000, null, "monthly", "PLN"));
  const gbp = aJobApplication(paying(60_000, null, "annual", "GBP"));
  const bare = aJobApplication(paying(99_000, null, "monthly", null));
  const plnHigh = aJobApplication(paying(30_000, null, "monthly", "PLN"));
  const usd = aJobApplication(paying(8_000, null, "monthly", "USD"));
  const nothing = aJobApplication(paying(null, null, null, null));
  const eurLow = aJobApplication(paying(5_000, null, "monthly", "EUR"));
  const pln = aJobApplication(paying(20_000, null, "monthly", "PLN"));
  const newest = [
    pln,
    eurLow,
    nothing,
    usd,
    plnHigh,
    bare,
    gbp,
    plnLow,
    eurHigh,
  ];

  it("groups by the most common currency first, then by count, alphabetical on a tie, then no currency", () => {
    // PLN three times, EUR twice, GBP and USD once each.
    expect(
      order(newest, { column: "salary", direction: "descending" }),
    ).toEqual(
      ids(plnHigh, pln, plnLow, eurHigh, eurLow, gbp, usd, bare, nothing),
    );
  });

  it("reverses within each group and keeps the groups in their order", () => {
    expect(order(newest, { column: "salary", direction: "ascending" })).toEqual(
      ids(plnLow, pln, plnHigh, eurLow, eurHigh, gbp, usd, bare, nothing),
    );
  });

  it("reads the groups off every Job Application, not only the ones the filters admit", () => {
    // Narrowed to one PLN and both EUR, EUR is the more common here — but the
    // user quotes in PLN, and narrowing the view must not reshuffle the groups.
    const shown = [eurLow, pln, eurHigh];

    expect(
      ordered(
        shown,
        { column: "salary", direction: "descending" },
        { everything: newest, period: "monthly", today: TODAY },
      ).map(({ id }) => id),
    ).toEqual(ids(pln, eurHigh, eurLow));
  });

  it("counts only salaries: a currency recorded beside no figure quotes nothing", () => {
    const eurNoFigure = aJobApplication(paying(null, null, null, "EUR"));
    const alsoEurNoFigure = aJobApplication(paying(null, null, null, "EUR"));
    const eur = aJobApplication(paying(9_000, null, "monthly", "EUR"));
    const plnOne = aJobApplication(paying(5_000, null, "monthly", "PLN"));
    const plnTwo = aJobApplication(paying(6_000, null, "monthly", "PLN"));
    const listed = [plnTwo, plnOne, eur, alsoEurNoFigure, eurNoFigure];

    expect(
      order(listed, { column: "salary", direction: "descending" }),
    ).toEqual(ids(plnTwo, plnOne, eur, alsoEurNoFigure, eurNoFigure));
  });
});

/**
 * A heading pressed again and again: its natural direction, then the other
 * one, then back to newest added.
 */
describe("nextSort", () => {
  it("starts an unsorted list on the column's natural direction", () => {
    expect(nextSort(null, "company")).toEqual({
      column: "company",
      direction: "ascending",
    });
    expect(nextSort(null, "salary")).toEqual({
      column: "salary",
      direction: "descending",
    });
  });

  it("reverses the column on the second press", () => {
    expect(
      nextSort({ column: "salary", direction: "descending" }, "salary"),
    ).toEqual({ column: "salary", direction: "ascending" });
  });

  it("clears back to newest added on the third press", () => {
    expect(
      nextSort({ column: "salary", direction: "ascending" }, "salary"),
    ).toBeNull();
  });

  it("starts a different column at its own natural direction", () => {
    expect(
      nextSort({ column: "company", direction: "descending" }, "excitement"),
    ).toEqual({ column: "excitement", direction: "descending" });
  });
});

/**
 * The remembered sort, as it comes back out of browser storage — which holds
 * strings, and holds whatever was in it before this code existed.
 */
describe("sortFrom", () => {
  it("reads back every sort the user can choose", () => {
    const sort: DashboardSort = { column: "closes", direction: "descending" };

    expect(sortFrom(storedSort(sort))).toEqual(sort);
    expect(sortFrom(storedSort(null))).toBeNull();
  });

  it("starts a user with no stored sort on newest added", () => {
    expect(sortFrom(null)).toBeNull();
  });

  it("reads anything it does not recognise as newest added", () => {
    expect(sortFrom("applied:descending")).toBeNull();
    expect(sortFrom("salary:sideways")).toBeNull();
    expect(sortFrom("salary")).toBeNull();
    expect(sortFrom("salary:descending:extra")).toBeNull();
    expect(sortFrom("")).toBeNull();
  });
});
