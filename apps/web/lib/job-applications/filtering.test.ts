import type { JobApplication } from "@repo/schema";
import { describe, expect, it } from "vitest";
import { emptiness, matching, NO_FILTER } from "./filtering";

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
const ALL = [BASECAMP, STRIPE, SHOPIFY];

const companies = (jobApplications: JobApplication[]) =>
  jobApplications.map((one) => one.company);

describe("matching", () => {
  it("keeps the whole set when nothing has been asked of it", () => {
    expect(matching(ALL, NO_FILTER)).toEqual(ALL);
  });

  it("matches part of a company name, whatever case it was typed in", () => {
    expect(companies(matching(ALL, { ...NO_FILTER, search: "sTRI" }))).toEqual([
      "Stripe",
    ]);
  });

  it("matches part of a job title", () => {
    expect(
      companies(matching(ALL, { ...NO_FILTER, search: "engineer" })),
    ).toEqual(["Stripe", "Shopify"]);
  });

  it("finds nothing when nothing carries the search", () => {
    expect(matching(ALL, { ...NO_FILTER, search: "plumber" })).toEqual([]);
  });

  it("ignores whitespace around the search", () => {
    expect(
      companies(matching(ALL, { ...NO_FILTER, search: "  stripe  " })),
    ).toEqual(["Stripe"]);
  });

  it("restores the full set once the search is cleared", () => {
    expect(matching(ALL, { ...NO_FILTER, search: "" })).toEqual(ALL);
    expect(matching(ALL, { ...NO_FILTER, search: "   " })).toEqual(ALL);
  });

  it("keeps only the Job Applications at the Status asked for", () => {
    expect(
      companies(matching(ALL, { ...NO_FILTER, status: "applied" })),
    ).toEqual(["Stripe"]);
  });

  it("asks for the search and the Status together, not either one", () => {
    expect(
      matching(ALL, { search: "engineer", status: "interviewing" }),
    ).toEqual([SHOPIFY]);
    expect(matching(ALL, { search: "basecamp", status: "applied" })).toEqual(
      [],
    );
  });

  it("leaves the order it was given alone", () => {
    expect(companies(matching(ALL, { ...NO_FILTER, search: "e" }))).toEqual([
      "Basecamp",
      "Stripe",
      "Shopify",
    ]);
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
    expect(emptiness([], [], { search: "plumber", status: "applied" })).toEqual(
      { kind: "nothing-yet" },
    );
  });

  it("tells a search that found nothing apart from having nothing", () => {
    expect(emptiness(ALL, [], { ...NO_FILTER, search: "plumber" })).toEqual({
      kind: "nothing-matches",
      narrowedBy: "search",
    });
  });

  it("names the Status when the Status is what emptied the view", () => {
    expect(emptiness(ALL, [], { ...NO_FILTER, status: "offer" })).toEqual({
      kind: "nothing-matches",
      narrowedBy: "status",
    });
  });

  it("names both when both are narrowing", () => {
    expect(
      emptiness(ALL, [], { search: "basecamp", status: "applied" }),
    ).toEqual({ kind: "nothing-matches", narrowedBy: "both" });
  });

  it("does not count a search of nothing but whitespace as a search", () => {
    expect(emptiness(ALL, [], { search: "   ", status: "offer" })).toEqual({
      kind: "nothing-matches",
      narrowedBy: "status",
    });
  });
});
