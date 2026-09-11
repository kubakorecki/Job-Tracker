import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { OTHER_TEST_USER, TEST_USER } from "../test-support/users";
import { MONTHLY_AI_USAGE_LIMIT, mayStartAiCall } from "./meter";
import {
  aiUsageMonth,
  aiUsageSoFar,
  forgetAiUsage,
  recordAiUsage,
  setAiUsage,
} from "./repository";

/**
 * AI Usage as every caller sees it. The meter is a real row in the real table,
 * cleared around each test — a meter that did not survive a request would not
 * be one.
 *
 * What is worth proving here is the shape of the limit rather than the
 * arithmetic: one meter that four different kinds of call spend into, checked
 * before a call starts and never during it, so that a call admitted within the
 * limit finishes and overshoots (ADR-0009).
 */

beforeEach(clearMeters);
afterAll(clearMeters);

async function clearMeters(): Promise<void> {
  await forgetAiUsage(TEST_USER.id);
  await forgetAiUsage(OTHER_TEST_USER.id);
}

describe("recording what a call spent", () => {
  it("starts a month at nothing spent", async () => {
    expect(await aiUsageSoFar(TEST_USER.id)).toBe(0);
  });

  it("adds each call to the month's total", async () => {
    expect(await recordAiUsage(TEST_USER.id, 12_000)).toBe(12_000);
    expect(await recordAiUsage(TEST_USER.id, 3_500)).toBe(15_500);
    expect(await aiUsageSoFar(TEST_USER.id)).toBe(15_500);
  });

  it("records a call that reported nothing as nothing", async () => {
    expect(await recordAiUsage(TEST_USER.id, 0)).toBe(0);
  });

  it("gives each user their own meter", async () => {
    await recordAiUsage(TEST_USER.id, 40_000);

    expect(await aiUsageSoFar(OTHER_TEST_USER.id)).toBe(0);
  });

  it("gives each month its own meter", async () => {
    const lastMonth = aiUsageMonth(new Date("2026-01-15T00:00:00Z"));
    await setAiUsage(TEST_USER.id, MONTHLY_AI_USAGE_LIMIT, lastMonth);

    try {
      expect(await aiUsageSoFar(TEST_USER.id)).toBe(0);
      expect(await mayStartAiCall(TEST_USER.id)).toBe("within-limit");
    } finally {
      await forgetAiUsage(TEST_USER.id, lastMonth);
    }
  });
});

describe("whether a call may start", () => {
  it("lets one through while the allowance has room", async () => {
    expect(await mayStartAiCall(TEST_USER.id)).toBe("within-limit");
  });

  it("refuses one once the allowance is spent", async () => {
    await setAiUsage(TEST_USER.id, MONTHLY_AI_USAGE_LIMIT);

    expect(await mayStartAiCall(TEST_USER.id)).toBe("over-limit");
  });

  it("admits the call that will spend the last of the allowance", async () => {
    await setAiUsage(TEST_USER.id, MONTHLY_AI_USAGE_LIMIT - 1);

    expect(await mayStartAiCall(TEST_USER.id)).toBe("within-limit");
  });

  it("lets an admitted call finish and overshoot, then refuses the next", async () => {
    await setAiUsage(TEST_USER.id, MONTHLY_AI_USAGE_LIMIT - 1);

    // Admitted on the budget it had before it started, and priced only once it
    // ended: a reply cannot be costed until its last chunk arrives, so the
    // overshoot is one call's worth and the limit holds from the next one.
    expect(await mayStartAiCall(TEST_USER.id)).toBe("within-limit");
    const spent = await recordAiUsage(TEST_USER.id, 20_000);

    expect(spent).toBeGreaterThan(MONTHLY_AI_USAGE_LIMIT);
    expect(await mayStartAiCall(TEST_USER.id)).toBe("over-limit");
  });

  it("keeps refusing once the allowance is over, rather than wrapping around", async () => {
    await setAiUsage(TEST_USER.id, MONTHLY_AI_USAGE_LIMIT * 2);

    expect(await mayStartAiCall(TEST_USER.id)).toBe("over-limit");
    expect(await mayStartAiCall(TEST_USER.id)).toBe("over-limit");
  });

  it("gives each user their own allowance", async () => {
    await setAiUsage(TEST_USER.id, MONTHLY_AI_USAGE_LIMIT);

    expect(await mayStartAiCall(TEST_USER.id)).toBe("over-limit");
    expect(await mayStartAiCall(OTHER_TEST_USER.id)).toBe("within-limit");
  });
});

describe("the month a meter is keyed on", () => {
  it("is the UTC month, not the reader's", () => {
    // Late enough on the 31st in UTC+13 that a local reading would say the 1st
    // of the next month.
    expect(aiUsageMonth(new Date("2026-01-31T23:30:00Z"))).toBe("2026-01-01");
  });

  it("is the month itself, whichever day of it the call was made on", () => {
    expect(aiUsageMonth(new Date("2026-09-11T09:00:00Z"))).toBe("2026-09-01");
    expect(aiUsageMonth(new Date("2026-09-01T00:00:00Z"))).toBe("2026-09-01");
  });
});
