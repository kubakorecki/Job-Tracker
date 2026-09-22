import type { JobApplication } from "@repo/schema";
import { describe, expect, it } from "vitest";
import { emptiness, matching, NO_FILTER } from "./filtering";

/** Every case is read against a fixed day, so a silence never moves under it. */
const TODAY = "2026-03-01";

/**
 * What the dashboard shows once the user has narrowed it, with no board, no
 * table and no cache in sight: the list that goes in, and the list that comes
 * back out — and, when nothing comes back out, which of the two blank screens
 * the user is owed.
 */

const A_JOB_APPLICATION: JobApplication = {
  id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
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
  interviews: [],
  status: "bookmarked",
  source: null,
  appliedAt: null,
  excitement: null,
  notes: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const aJobApplication = (fields: Partial<JobApplication>): JobApplication => ({
  ...A_JOB_APPLICATION,
  ...fields,
});

const BASECAMP = aJobApplication({
  id: "1",
  company: "Basecamp",
  jobTitle: "Programmer",
});
const STRIPE = aJobApplication({
  id: "2",
  company: "Stripe",
  jobTitle: "Backend Engineer",
  status: "applied",
});
const SHOPIFY = aJobApplication({
  id: "3",
  company: "Shopify",
  jobTitle: "Staff Engineer",
  status: "interviewing",
});
/** Applied five weeks before the fixed today: going cold, not yet ghosted. */
const LINEAR = aJobApplication({
  id: "4",
  company: "Linear",
  jobTitle: "Product Engineer",
  status: "applied",
  updatedAt: "2026-02-01T00:00:00.000Z",
});
const ALL = [BASECAMP, STRIPE, SHOPIFY, LINEAR];

const companies = (jobApplications: JobApplication[]) =>
  jobApplications.map((one) => one.company);

describe("matching", () => {
  it("keeps the whole set when nothing has been asked of it", () => {
    expect(matching(ALL, NO_FILTER, TODAY)).toEqual(ALL);
  });

  it("matches part of a company name, whatever case it was typed in", () => {
    expect(
      companies(matching(ALL, { ...NO_FILTER, search: "sTRI" }, TODAY)),
    ).toEqual(["Stripe"]);
  });

  it("matches part of a job title", () => {
    expect(
      companies(matching(ALL, { ...NO_FILTER, search: "engineer" }, TODAY)),
    ).toEqual(["Stripe", "Shopify", "Linear"]);
  });

  it("finds nothing when nothing carries the search", () => {
    expect(matching(ALL, { ...NO_FILTER, search: "plumber" }, TODAY)).toEqual(
      [],
    );
  });

  it("ignores whitespace around the search", () => {
    expect(
      companies(matching(ALL, { ...NO_FILTER, search: "  stripe  " }, TODAY)),
    ).toEqual(["Stripe"]);
  });

  it("restores the full set once the search is cleared", () => {
    expect(matching(ALL, { ...NO_FILTER, search: "" }, TODAY)).toEqual(ALL);
    expect(matching(ALL, { ...NO_FILTER, search: "   " }, TODAY)).toEqual(ALL);
  });

  it("keeps only the Job Applications at the Status asked for", () => {
    expect(
      companies(matching(ALL, { ...NO_FILTER, status: "applied" }, TODAY)),
    ).toEqual(["Stripe", "Linear"]);
  });

  it("asks for the search and the Status together, not either one", () => {
    expect(
      matching(
        ALL,
        { ...NO_FILTER, search: "engineer", status: "interviewing" },
        TODAY,
      ),
    ).toEqual([SHOPIFY]);
    expect(
      matching(
        ALL,
        { ...NO_FILTER, search: "basecamp", status: "applied" },
        TODAY,
      ),
    ).toEqual([]);
  });

  it("leaves the order it was given alone", () => {
    expect(
      companies(matching(ALL, { ...NO_FILTER, search: "e" }, TODAY)),
    ).toEqual(["Basecamp", "Stripe", "Shopify", "Linear"]);
  });

  it("keeps only the ones going cold when asked for those", () => {
    expect(
      companies(matching(ALL, { ...NO_FILTER, silence: "cold" }, TODAY)),
    ).toEqual(["Linear"]);
  });

  it("keeps only the ghosted ones when asked for those", () => {
    expect(
      companies(matching(ALL, { ...NO_FILTER, silence: "ghosted" }, TODAY)),
    ).toEqual(["Stripe", "Shopify"]);
  });

  it("never admits a Job Application nobody is waiting on", () => {
    for (const silence of ["cold", "ghosted"] as const) {
      expect(
        companies(matching(ALL, { ...NO_FILTER, silence }, TODAY)),
      ).not.toContain("Basecamp");
    }
  });

  it("leaves off the rejected and the withdrawn when closed ones are hidden", () => {
    const WITH_CLOSED = [
      ...ALL,
      aJobApplication({ id: "5", company: "Vercel", status: "rejected" }),
      aJobApplication({ id: "6", company: "Figma", status: "withdrawn" }),
      aJobApplication({ id: "7", company: "Notion", status: "offer" }),
    ];

    expect(
      companies(
        matching(WITH_CLOSED, { ...NO_FILTER, hideClosed: true }, TODAY),
      ),
    ).toEqual(["Basecamp", "Stripe", "Shopify", "Linear", "Notion"]);
  });

  it("keeps the closed ones while they are not hidden", () => {
    const REJECTED = aJobApplication({ id: "5", status: "rejected" });

    expect(matching([REJECTED], NO_FILTER, TODAY)).toEqual([REJECTED]);
  });
});

describe("emptiness", () => {
  it("has nothing to say while there is something to show", () => {
    expect(emptiness(ALL, ALL, NO_FILTER)).toBeNull();
    expect(emptiness(ALL, [STRIPE], { ...NO_FILTER, search: "stripe" })).toBe(
      null,
    );
  });

  it("says the user has none at all when they have none at all", () => {
    expect(emptiness([], [], NO_FILTER)).toEqual({ kind: "nothing-yet" });
  });

  it("still says none at all when a filter is up but there is nothing to filter", () => {
    expect(
      emptiness([], [], { ...NO_FILTER, search: "plumber", status: "applied" }),
    ).toEqual({ kind: "nothing-yet" });
  });

  it("tells a search that found nothing apart from having nothing", () => {
    expect(emptiness(ALL, [], { ...NO_FILTER, search: "plumber" })).toEqual({
      kind: "nothing-matches",
      narrowedBy: ["search"],
    });
  });

  it("names the Status when the Status is what emptied the view", () => {
    expect(emptiness(ALL, [], { ...NO_FILTER, status: "offer" })).toEqual({
      kind: "nothing-matches",
      narrowedBy: ["status"],
    });
  });

  it("names both when both are narrowing", () => {
    expect(
      emptiness(ALL, [], {
        ...NO_FILTER,
        search: "basecamp",
        status: "applied",
      }),
    ).toEqual({ kind: "nothing-matches", narrowedBy: ["status", "search"] });
  });

  it("names the silence when that is what emptied the view", () => {
    expect(
      emptiness(ALL, [], { ...NO_FILTER, status: "offer", silence: "cold" }),
    ).toEqual({
      kind: "nothing-matches",
      narrowedBy: ["status", "silence"],
    });
  });

  it("does not count a search of nothing but whitespace as a search", () => {
    expect(
      emptiness(ALL, [], { ...NO_FILTER, search: "   ", status: "offer" }),
    ).toEqual({
      kind: "nothing-matches",
      narrowedBy: ["status"],
    });
  });

  it("names the hidden closed ones when that is what emptied the view", () => {
    expect(emptiness(ALL, [], { ...NO_FILTER, hideClosed: true })).toEqual({
      kind: "nothing-matches",
      narrowedBy: ["closed"],
    });
  });
});
