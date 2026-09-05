import type { Coverage, Necessity } from "@repo/schema";
import { describe, expect, it } from "vitest";
import {
  coverageSource,
  type CoverageReadings,
  type CoverageSource,
  fitFractionOf,
  normalisedCoverageOf,
  resolvedCoverage,
} from "./compare";

/**
 * The comparison with no database, no model and no interface in sight: a skill
 * list and a Requirement go in, a Coverage comes out; three readings go in, the
 * one that speaks comes out; a Requirement list goes in and the ring's fraction
 * comes back.
 */

const NOTHING_READ: CoverageReadings = {
  normalisedCoverage: null,
  analysedCoverage: null,
  overriddenCoverage: null,
};

describe("normalisedCoverageOf", () => {
  it("answers have when the list holds the skill as the Posting worded it", () => {
    expect(normalisedCoverageOf("React", ["React", "Postgres"])).toBe("have");
  });

  it("answers missing when nothing in the list is the skill", () => {
    expect(normalisedCoverageOf("Terraform", ["React", "Postgres"])).toBe(
      "missing",
    );
  });

  it("answers missing against a list with nothing in it", () => {
    expect(normalisedCoverageOf("React", [])).toBe("missing");
  });

  it("case-folds both sides", () => {
    expect(normalisedCoverageOf("POSTGRES", ["postgres"])).toBe("have");
  });

  it("strips punctuation on both sides", () => {
    expect(normalisedCoverageOf("Node.js", ["Nodejs"])).toBe("have");
    expect(normalisedCoverageOf("CI/CD", ["ci cd"])).toBe("missing");
  });

  it("collapses whitespace and ignores what surrounds the words", () => {
    expect(
      normalisedCoverageOf("  Machine   Learning ", ["machine\tlearning"]),
    ).toBe("have");
  });

  it("matches a whole skill rather than a skill that contains it", () => {
    expect(normalisedCoverageOf("React", ["React Native"])).toBe("missing");
    expect(normalisedCoverageOf("React Native", ["React"])).toBe("missing");
  });

  it("cannot see what only an Analysis could — a quantity of experience", () => {
    expect(normalisedCoverageOf("5+ years of React", ["React"])).toBe(
      "missing",
    );
  });

  it("does not fold two spellings together without being told to", () => {
    expect(normalisedCoverageOf("Postgres", ["PostgreSQL"])).toBe("missing");
  });
});

describe("resolvedCoverage", () => {
  /** Three distinct values, so which of the three spoke is visible in the answer. */
  const NORMALISED = "missing" satisfies Coverage;
  const ANALYSED = "partial" satisfies Coverage;
  const OVERRIDDEN = "have" satisfies Coverage;

  const combinations: {
    readings: CoverageReadings;
    resolves: Coverage | null;
    from: CoverageSource | null;
  }[] = [
    { readings: NOTHING_READ, resolves: null, from: null },
    {
      readings: { ...NOTHING_READ, normalisedCoverage: NORMALISED },
      resolves: NORMALISED,
      from: "automatic",
    },
    {
      readings: { ...NOTHING_READ, analysedCoverage: ANALYSED },
      resolves: ANALYSED,
      from: "analysis",
    },
    {
      readings: { ...NOTHING_READ, overriddenCoverage: OVERRIDDEN },
      resolves: OVERRIDDEN,
      from: "override",
    },
    {
      readings: {
        normalisedCoverage: NORMALISED,
        analysedCoverage: ANALYSED,
        overriddenCoverage: null,
      },
      resolves: ANALYSED,
      from: "analysis",
    },
    {
      readings: {
        normalisedCoverage: NORMALISED,
        analysedCoverage: null,
        overriddenCoverage: OVERRIDDEN,
      },
      resolves: OVERRIDDEN,
      from: "override",
    },
    {
      readings: {
        normalisedCoverage: null,
        analysedCoverage: ANALYSED,
        overriddenCoverage: OVERRIDDEN,
      },
      resolves: OVERRIDDEN,
      from: "override",
    },
    {
      readings: {
        normalisedCoverage: NORMALISED,
        analysedCoverage: ANALYSED,
        overriddenCoverage: OVERRIDDEN,
      },
      resolves: OVERRIDDEN,
      from: "override",
    },
  ];

  it.each(combinations)(
    "reads $readings as $resolves",
    ({ readings, resolves }) => {
      expect(resolvedCoverage(readings)).toBe(resolves);
    },
  );

  it.each(combinations)(
    "reads $readings as spoken by $from",
    ({ readings, from }) => {
      expect(coverageSource(readings)).toBe(from);
    },
  );

  it("names the source of the very verdict it resolves to, in every combination", () => {
    // The badge says where a verdict came from and the panel says what it
    // said, so the two answers are worth nothing unless they are about the
    // same reading. One ordering underneath both is what makes that so.
    const readingOf: Record<CoverageSource, keyof CoverageReadings> = {
      automatic: "normalisedCoverage",
      analysis: "analysedCoverage",
      override: "overriddenCoverage",
    };

    for (const { readings } of combinations) {
      const spoke = coverageSource(readings);
      expect(spoke === null ? null : readings[readingOf[spoke]]).toBe(
        resolvedCoverage(readings),
      );
    }
  });

  it("returns each source's own verdict rather than a verdict of its own", () => {
    for (const spoken of ["have", "partial", "missing"] satisfies Coverage[]) {
      expect(
        resolvedCoverage({ ...NOTHING_READ, normalisedCoverage: spoken }),
      ).toBe(spoken);
      expect(
        resolvedCoverage({ ...NOTHING_READ, analysedCoverage: spoken }),
      ).toBe(spoken);
      expect(
        resolvedCoverage({ ...NOTHING_READ, overriddenCoverage: spoken }),
      ).toBe(spoken);
    }
  });
});

describe("fitFractionOf", () => {
  const asked = (
    necessity: Necessity,
    coverage: Coverage | null,
  ): CoverageReadings & { necessity: Necessity } => ({
    ...NOTHING_READ,
    necessity,
    normalisedCoverage: coverage,
  });

  it("counts a covered required Requirement as one", () => {
    expect(fitFractionOf([asked("required", "have")])).toEqual({
      covered: 1,
      required: 1,
    });
  });

  it("counts a partial required Requirement as one half", () => {
    expect(fitFractionOf([asked("required", "partial")])).toEqual({
      covered: 0.5,
      required: 1,
    });
  });

  it("counts a missing required Requirement as nothing, and still asks for it", () => {
    expect(fitFractionOf([asked("required", "missing")])).toEqual({
      covered: 0,
      required: 1,
    });
  });

  it("counts required Requirements only", () => {
    expect(
      fitFractionOf([
        asked("required", "have"),
        asked("required", "missing"),
        asked("preferred", "have"),
        asked("unstated", "have"),
      ]),
    ).toEqual({ covered: 1, required: 2 });
  });

  it("adds the halves up with the wholes", () => {
    expect(
      fitFractionOf([
        asked("required", "have"),
        asked("required", "partial"),
        asked("required", "partial"),
        asked("required", "missing"),
      ]),
    ).toEqual({ covered: 2, required: 4 });
  });

  it("has no fraction for a Job Application that asks nothing", () => {
    expect(fitFractionOf([])).toBeNull();
  });

  it("has no fraction when nothing is asked as required", () => {
    expect(
      fitFractionOf([asked("preferred", "have"), asked("unstated", "missing")]),
    ).toBeNull();
  });

  it("has no fraction when no required Requirement has been read at all", () => {
    expect(
      fitFractionOf([
        { ...NOTHING_READ, necessity: "required" },
        asked("preferred", "have"),
      ]),
    ).toBeNull();
  });

  it("keeps every required Requirement in the denominator, read or not", () => {
    expect(
      fitFractionOf([
        asked("required", "have"),
        { ...NOTHING_READ, necessity: "required" },
        { ...NOTHING_READ, necessity: "required" },
      ]),
    ).toEqual({ covered: 1, required: 3 });
  });

  it("counts the Coverage that wins the precedence, not the normalised one", () => {
    expect(
      fitFractionOf([
        {
          necessity: "required",
          normalisedCoverage: "missing",
          analysedCoverage: "partial",
          overriddenCoverage: "have",
        },
        {
          necessity: "required",
          normalisedCoverage: "missing",
          analysedCoverage: "partial",
          overriddenCoverage: null,
        },
      ]),
    ).toEqual({ covered: 1.5, required: 2 });
  });
});
