import type { JobStatus } from "@repo/schema";
import { describe, expect, it } from "vitest";
import {
  GHOSTED_AFTER_DAYS,
  GOING_COLD_AFTER_DAYS,
  QUIET_AFTER_DAYS,
  silenceDescription,
  silenceLabel,
  silenceOf,
} from "./silence";

/**
 * How long it has been since anybody said anything. Every case is written
 * against a fixed "today", for the same reason the Closing Date's are: a test
 * that read the clock would pass on the day it was written and fail a week
 * later.
 */

const TODAY = "2026-09-06";

const reading = (
  status: JobStatus,
  { appliedAt = null, updatedAt = `${TODAY}T00:00:00.000Z` }: Partial<Waiting> = {},
) => silenceOf({ status, appliedAt, updatedAt }, TODAY);

type Waiting = { appliedAt: string | null; updatedAt: string };

/** A Job Application last touched `days` before the fixed today. */
const daysAgo = (days: number): string => {
  const at = Date.parse(`${TODAY}T00:00:00.000Z`) - days * 24 * 60 * 60 * 1000;
  return new Date(at).toISOString();
};

describe("silenceOf", () => {
  it("says nothing about somebody there is nobody to hear from", () => {
    expect(reading("bookmarked", { updatedAt: daysAgo(90) })).toBeNull();
  });

  it("says nothing about a Job Application that has already been answered", () => {
    for (const answered of ["offer", "rejected", "withdrawn"] as const) {
      expect(reading(answered, { updatedAt: daysAgo(90) })).toBeNull();
    }
  });

  it("says nothing about a week of quiet, which is not yet quiet", () => {
    expect(reading("applied", { updatedAt: daysAgo(0) })).toBeNull();
    expect(reading("applied", { updatedAt: daysAgo(7) })).toBeNull();
  });

  it("is quiet from the eighth day", () => {
    expect(reading("applied", { updatedAt: daysAgo(8) })).toEqual({
      kind: "quiet",
      days: 8,
      since: "2026-08-29",
    });
    expect(QUIET_AFTER_DAYS).toBe(8);
  });

  it("stays quiet to the end of the third week", () => {
    expect(reading("applied", { updatedAt: daysAgo(20) })?.kind).toBe("quiet");
  });

  it("is going cold at three weeks", () => {
    expect(reading("applied", { updatedAt: daysAgo(21) })?.kind).toBe("cold");
    expect(reading("applied", { updatedAt: daysAgo(44) })?.kind).toBe("cold");
    expect(GOING_COLD_AFTER_DAYS).toBe(21);
  });

  it("is ghosted after six weeks and a bit", () => {
    expect(reading("applied", { updatedAt: daysAgo(45) })).toEqual({
      kind: "ghosted",
      days: 45,
      since: "2026-07-23",
    });
    expect(GHOSTED_AFTER_DAYS).toBe(45);
  });

  it("counts an Interviewing Job Application too, which is still waiting", () => {
    expect(reading("interviewing", { updatedAt: daysAgo(34) })?.kind).toBe("cold");
  });

  it("counts from the last thing that happened, not the first", () => {
    // Applied two months ago, and something happened a fortnight back: the
    // silence is a fortnight old, not two months.
    expect(
      reading("applied", { appliedAt: daysAgo(60), updatedAt: daysAgo(14) }),
    ).toEqual({ kind: "quiet", days: 14, since: "2026-08-23" });
  });

  it("takes the applied date where it is the later of the two", () => {
    // A Job Application recorded before it was sent: the date the user gave is
    // what actually happened, and the record was written before it.
    expect(
      reading("applied", { appliedAt: daysAgo(10), updatedAt: daysAgo(30) }),
    ).toEqual({ kind: "quiet", days: 10, since: "2026-08-27" });
  });

  it("never counts backwards from a date the user put in the future", () => {
    expect(reading("applied", { appliedAt: daysAgo(-5), updatedAt: daysAgo(90) })).toBeNull();
  });
});

describe("silenceLabel", () => {
  it("says the reading and the count, never one without the other", () => {
    expect(silenceLabel({ kind: "quiet", days: 12, since: "2026-08-25" })).toBe("Quiet · 12d");
    expect(silenceLabel({ kind: "cold", days: 34, since: "2026-08-03" })).toBe("Going cold · 34d");
    expect(silenceLabel({ kind: "ghosted", days: 61, since: "2026-07-07" })).toBe("Ghosted · 61d");
  });
});

describe("silenceDescription", () => {
  it("names the day the counting starts from, which the label never does", () => {
    expect(silenceDescription({ kind: "cold", days: 34, since: "2026-08-03" })).toBe(
      "Nothing has been heard since 3 Aug 2026 — 34 days. Nobody owes you a reply.",
    );
  });

  it("counts a single day in the singular", () => {
    expect(silenceDescription({ kind: "quiet", days: 1, since: "2026-09-05" })).toContain(
      "1 day.",
    );
  });
});
