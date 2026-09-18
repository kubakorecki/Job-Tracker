import { describe, expect, it } from "vitest";
import {
  fallsIn,
  monthOfDay,
  monthOfInstant,
  monthsUpTo,
  previousMonth,
} from "./month";

/**
 * The month a report is about, and which days belong to it. Every case names
 * its own zone, because the whole reason these exist is that the answer is
 * different in two of them.
 */

const WARSAW = "Europe/Warsaw";
const AUCKLAND = "Pacific/Auckland";

describe("monthOfInstant", () => {
  it("reads an instant as the month it fell in where the user was", () => {
    expect(monthOfInstant("2026-09-15T12:00:00.000Z", WARSAW)).toBe("2026-09");
  });

  it("keeps a late September evening in September for the user living it", () => {
    // Half past eleven on the last night of September in Warsaw, which UTC
    // calls half past nine — and which a report counted in UTC would still
    // have got right. The one after it is the case that matters.
    expect(monthOfInstant("2026-09-30T21:30:00.000Z", WARSAW)).toBe("2026-09");
  });

  it("puts an hour after midnight into the month the user woke up in", () => {
    // Half past midnight on 1 October in Warsaw is half past ten at night on
    // 30 September in UTC. It belongs to October's report, because that is the
    // month the user was in when it happened.
    expect(monthOfInstant("2026-09-30T22:30:00.000Z", WARSAW)).toBe("2026-10");
  });

  it("answers a zone half a day away the same way", () => {
    expect(monthOfInstant("2026-09-30T12:00:00.000Z", AUCKLAND)).toBe(
      "2026-10",
    );
  });
});

describe("monthOfDay", () => {
  it("is the month a calendar day falls in", () => {
    expect(monthOfDay("2026-09-01")).toBe("2026-09");
  });
});

describe("fallsIn", () => {
  it("takes the days of the month and nothing either side of them", () => {
    expect(fallsIn("2026-09-01", "2026-09")).toBe(true);
    expect(fallsIn("2026-09-30", "2026-09")).toBe(true);
    expect(fallsIn("2026-08-31", "2026-09")).toBe(false);
    expect(fallsIn("2026-10-01", "2026-09")).toBe(false);
  });
});

describe("previousMonth", () => {
  it("is the month before", () => {
    expect(previousMonth("2026-09")).toBe("2026-08");
  });

  it("crosses the turn of the year", () => {
    expect(previousMonth("2026-01")).toBe("2025-12");
  });
});

describe("monthsUpTo", () => {
  it("counts back from the month given, that month first", () => {
    expect(monthsUpTo("2026-02", 4)).toEqual([
      "2026-02",
      "2026-01",
      "2025-12",
      "2025-11",
    ]);
  });

  it("offers nothing at all where nothing was asked for", () => {
    expect(monthsUpTo("2026-02", 0)).toEqual([]);
  });
});
