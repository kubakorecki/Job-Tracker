import type { Coverage, Necessity } from "@repo/schema";
import { describe, expect, it } from "vitest";
import {
  fitBreakdownOf,
  fitSegments,
  fitSentence,
  type FitBreakdown,
} from "./fit-banner";

/**
 * The banner at the top of a Job Application: the same fraction the board's
 * ring draws, said in a sentence and drawn as one bar per Requirement.
 */

/** A required Requirement whose resolved Coverage is `coverage`. */
const asked = (
  coverage: Coverage | null,
  necessity: Necessity = "required",
) => ({
  necessity,
  normalisedCoverage: coverage,
  analysedCoverage: null,
  overriddenCoverage: null,
});

const breakdown = (...coverages: (Coverage | null)[]) =>
  fitBreakdownOf(coverages.map((coverage) => asked(coverage)));

describe("fitBreakdownOf", () => {
  it("counts each reading of the required Requirements", () => {
    expect(breakdown("have", "have", "partial", "missing", null)).toEqual({
      have: 2,
      partial: 1,
      missing: 1,
      unread: 1,
      required: 5,
      covered: 2.5,
    } satisfies FitBreakdown);
  });

  it("counts a half for every partial", () => {
    expect(breakdown("partial", "partial")?.covered).toBe(1);
  });

  it("leaves the preferred Requirements out of it", () => {
    expect(
      fitBreakdownOf([asked("have"), asked("missing", "preferred")]),
    ).toEqual({
      have: 1,
      partial: 0,
      missing: 0,
      unread: 0,
      required: 1,
      covered: 1,
    } satisfies FitBreakdown);
  });

  it("has nothing to say about a Posting that insists on nothing", () => {
    expect(fitBreakdownOf([])).toBeNull();
    expect(fitBreakdownOf([asked("have", "preferred")])).toBeNull();
  });

  it("has nothing to say until something has been read", () => {
    expect(breakdown(null, null)).toBeNull();
  });
});

describe("fitSentence", () => {
  it("names the fraction and how the halves arose", () => {
    expect(fitSentence(breakdown("have", "have", "partial", "missing")!)).toBe(
      "Your Profile answers 2.5 of the 4 things this Posting insists on — 2 outright, 1 in part.",
    );
  });

  it("says nothing about parts where there are none", () => {
    expect(fitSentence(breakdown("have", "missing")!)).toBe(
      "Your Profile answers 1 of the 2 things this Posting insists on.",
    );
  });

  it("says the whole of it where the whole of it is answered", () => {
    expect(fitSentence(breakdown("have", "have")!)).toBe(
      "Your Profile answers everything this Posting insists on.",
    );
  });

  it("counts one thing in the singular", () => {
    expect(fitSentence(breakdown("missing")!)).toBe(
      "Your Profile answers none of the one thing this Posting insists on.",
    );
  });

  it("says how many are still unread", () => {
    expect(fitSentence(breakdown("have", null, null)!)).toBe(
      "Your Profile answers 1 of the 3 things this Posting insists on. Two of them have not been read yet.",
    );
  });
});

describe("fitSegments", () => {
  it("draws one bar per required Requirement, best first", () => {
    expect(fitSegments(breakdown("missing", "have", null, "partial")!)).toEqual(
      ["have", "partial", "missing", "unread"],
    );
  });
});
