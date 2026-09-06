import type { JobStatus } from "@repo/schema";
import { describe, expect, it } from "vitest";
import {
  closingDescription,
  closingLabel,
  closingOf,
  CLOSING_SOON_DAYS,
} from "./closing";

/**
 * What a Closing Date amounts to today. Every case is written against a fixed
 * "today", because a test that read the clock would pass in the morning and
 * fail in the evening of the day a Closing Date falls on.
 */

const TODAY = "2026-09-06";

const reading = (closesOn: string | null, status: JobStatus = "bookmarked") =>
  closingOf({ closesOn, status }, TODAY);

describe("closingOf", () => {
  it("says nothing about a Job Application with no Closing Date", () => {
    expect(reading(null)).toBeNull();
  });

  it("is open where the Closing Date is comfortably ahead", () => {
    expect(reading("2026-10-06")).toEqual({ kind: "open", days: 30, on: "2026-10-06" });
  });

  it("is closing soon where a bookmark has a week or less left", () => {
    expect(reading("2026-09-13")).toEqual({ kind: "closing-soon", days: 7, on: "2026-09-13" });
  });

  it("counts today itself as closing soon, not as closed", () => {
    expect(reading(TODAY)).toEqual({ kind: "closing-soon", days: 0, on: TODAY });
  });

  it("turns urgent the day the week begins, and not before", () => {
    expect(reading("2026-09-14")).toEqual({ kind: "open", days: 8, on: "2026-09-14" });
    expect(CLOSING_SOON_DAYS).toBe(7);
  });

  it("never hurries a Job Application the user has already applied for", () => {
    expect(reading("2026-09-08", "applied")).toEqual({ kind: "open", days: 2, on: "2026-09-08" });
  });

  it("is missed where the Closing Date passed and the user never applied", () => {
    expect(reading("2026-09-01")).toEqual({ kind: "missed", days: 5, on: "2026-09-01" });
  });

  it("is closed where the Closing Date passed and the user did apply", () => {
    expect(reading("2026-08-07", "applied")).toEqual({
      kind: "closed",
      days: 30,
      on: "2026-08-07",
    });
  });

  it("is closed rather than missed once an outcome has been reached", () => {
    for (const status of ["interviewing", "offer", "rejected", "withdrawn"] as const) {
      expect(reading("2026-09-01", status)).toEqual({
        kind: "closed",
        days: 5,
        on: "2026-09-01",
      });
    }
  });

  it("counts whole days across a month boundary", () => {
    expect(reading("2026-10-01")).toEqual({ kind: "open", days: 25, on: "2026-10-01" });
  });

  it("counts in UTC, so a day is a day wherever it is read", () => {
    // The month either side of a daylight-saving change in most of Europe:
    // twenty-eight days, not twenty-seven and a bit rounded down.
    expect(
      closingOf({ closesOn: "2026-11-01", status: "applied" }, "2026-10-04"),
    ).toEqual({ kind: "open", days: 28, on: "2026-11-01" });
  });
});

describe("closingLabel", () => {
  it("counts down to a Closing Date still ahead", () => {
    expect(closingLabel(reading("2026-10-06")!)).toBe("Closes in 30 days");
  });

  it("names today and tomorrow rather than counting them", () => {
    expect(closingLabel(reading(TODAY)!)).toBe("Closes today");
    expect(closingLabel(reading("2026-09-07")!)).toBe("Closes tomorrow");
  });

  it("counts up from a Closing Date that has passed", () => {
    expect(closingLabel(reading("2026-09-01")!)).toBe("Closed 5 days ago");
    expect(closingLabel(reading("2026-09-05")!)).toBe("Closed yesterday");
  });

  it("writes one day as a day rather than as days", () => {
    expect(closingLabel({ kind: "open", days: 1, on: "2026-09-07" })).toBe("Closes tomorrow");
    expect(closingLabel({ kind: "closed", days: 1, on: "2026-09-05" })).toBe("Closed yesterday");
  });
});

describe("closingDescription", () => {
  it("names the day itself, which the label never does", () => {
    expect(closingDescription(reading("2026-10-06")!)).toContain(
      "6 Oct 2026",
    );
  });

  it("asks a bookmark with a week left to act", () => {
    expect(closingDescription(reading("2026-09-08")!)).toBe(
      "Applications close on 8 Sept 2026, in 2 days — apply before then.",
    );
  });

  it("says plainly that a bookmark was never applied for", () => {
    expect(closingDescription(reading("2026-09-01")!)).toBe(
      "Applications closed on 1 Sept 2026, 5 days ago, and this was never applied for.",
    );
  });

  it("says the intake is over and how long the silence has run", () => {
    expect(
      closingDescription(reading("2026-08-07", "applied")!),
    ).toBe(
      "Applications closed on 7 Aug 2026, 30 days ago. Any contact now comes from them.",
    );
  });
});
