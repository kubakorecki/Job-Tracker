import { describe, expect, it } from "vitest";
import { MONTHLY_AI_USAGE_LIMIT } from "./meter";
import { aiUsageReading, aiUsageSentence } from "./reading";

/**
 * AI Usage as the Profile draws it. The arithmetic is one division, so what is
 * worth proving is the wording and the edges around it: a month that is spent
 * says so, a month that overshot says what it really spent, the figure never
 * reads as spent while a call would still be admitted, and the day the tokens
 * come back is the next month rather than thirty days from now.
 *
 * Read against a month given as an argument, never the clock, so these cases
 * read the same in December as in September.
 */

const SEPTEMBER = "2026-09-01";

describe("where the month stands", () => {
  it("reads a month nothing has been spent in as nothing spent", () => {
    const reading = aiUsageReading(0, SEPTEMBER);

    expect(reading.percent).toBe(0);
    expect(reading.isSpent).toBe(false);
    expect(aiUsageSentence(reading)).toBe(
      "You have spent nothing this month. All 3,000,000 tokens of the monthly limit are still there.",
    );
  });

  it("says what has been spent, of what, in tokens", () => {
    const reading = aiUsageReading(420_000, SEPTEMBER);

    expect(reading.percent).toBe(14);
    expect(aiUsageSentence(reading)).toBe(
      "You have spent 420,000 tokens this month, against a monthly limit of 3,000,000 — 14% of it.",
    );
  });

  it("counts a spend too small to round to a per cent as one, rather than as none", () => {
    // Rounded up, so that any spending at all shows as some and the figure and
    // the bar beside it never disagree about whether the month has begun.
    const reading = aiUsageReading(1_200, SEPTEMBER);

    expect(reading.percent).toBe(1);
    expect(reading.isSpent).toBe(false);
  });

  it("says nothing in tokens the month has not spent", () => {
    // The limit is the shipped constant rather than a number written down
    // here, so the sentence cannot go on naming a figure the product changed.
    expect(aiUsageSentence(aiUsageReading(0, SEPTEMBER))).toContain(
      "3,000,000",
    );
    expect(MONTHLY_AI_USAGE_LIMIT).toBe(3_000_000);
  });

  it("never words the meter as a quota, credits, an allowance or a budget", () => {
    // The four words `CONTEXT.md` tells the interface not to use for AI Usage.
    for (const spent of [0, 420_000, MONTHLY_AI_USAGE_LIMIT]) {
      const said = aiUsageSentence(aiUsageReading(spent, SEPTEMBER));

      expect(said).not.toMatch(/quota|credits|allowance|budget/i);
    }
  });
});

describe("a month whose tokens are gone", () => {
  it("reads the limit itself as spent, as the check before a call does", () => {
    const reading = aiUsageReading(MONTHLY_AI_USAGE_LIMIT, SEPTEMBER);

    expect(reading.isSpent).toBe(true);
    expect(reading.percent).toBe(100);
  });

  it("says the month is the reason, and not a fault", () => {
    const reading = aiUsageReading(MONTHLY_AI_USAGE_LIMIT, SEPTEMBER);

    expect(aiUsageSentence(reading)).toBe(
      "You have spent this month's AI Usage: 3,000,000 tokens against a monthly limit of 3,000,000. That is the month ending rather than a fault — reading a Posting, reading a CV, an Analysis and a Conversation all wait for the new month.",
    );
  });

  it("shows the overshoot an admitted call was allowed rather than hiding it", () => {
    // A call admitted within the limit finishes and overshoots (ADR-0009), so
    // the meter can stand past its own end and says so.
    const reading = aiUsageReading(MONTHLY_AI_USAGE_LIMIT + 120_000, SEPTEMBER);

    expect(reading.percent).toBe(104);
    expect(reading.isSpent).toBe(true);
  });
});

describe("the figure at the edge of the limit", () => {
  it("stops short of a hundred while a call would still be admitted", () => {
    // One token left is not the same news as none, and 100% beside a
    // Conversation that still answers would be the page contradicting
    // `mayStartAiCall`.
    const reading = aiUsageReading(MONTHLY_AI_USAGE_LIMIT - 1, SEPTEMBER);

    expect(reading.percent).toBe(99);
    expect(reading.isSpent).toBe(false);
    expect(aiUsageSentence(reading)).toContain("99% of it");
  });

  it("reaches a hundred only once the month is spent", () => {
    expect(aiUsageReading(MONTHLY_AI_USAGE_LIMIT, SEPTEMBER).percent).toBe(100);
  });
});

describe("the bar the figure is drawn as", () => {
  it("is the figure itself while the month has room", () => {
    expect(aiUsageReading(420_000, SEPTEMBER).filled).toBe(14);
    expect(aiUsageReading(MONTHLY_AI_USAGE_LIMIT - 1, SEPTEMBER).filled).toBe(
      99,
    );
  });

  it("stops at its own end where the figure overshoots", () => {
    const reading = aiUsageReading(MONTHLY_AI_USAGE_LIMIT + 120_000, SEPTEMBER);

    expect(reading.percent).toBe(104);
    expect(reading.filled).toBe(100);
  });
});

describe("when the tokens come back", () => {
  it("is the first of the month after the one being read", () => {
    expect(aiUsageReading(0, SEPTEMBER).startsAgainOn).toBe(
      "2026-10-01T00:00:00.000Z",
    );
  });

  it("is January of the next year, read from a December", () => {
    expect(aiUsageReading(0, "2026-12-01").startsAgainOn).toBe(
      "2027-01-01T00:00:00.000Z",
    );
  });
});

describe("the month being read", () => {
  it("is named as a month and a year, not as a date", () => {
    expect(aiUsageReading(0, SEPTEMBER).monthSaid).toBe("September 2026");
    expect(aiUsageReading(0, "2027-01-01").monthSaid).toBe("January 2027");
  });
});
