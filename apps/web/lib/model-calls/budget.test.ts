import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { OTHER_TEST_USER, TEST_USER } from "../test-support/users";
import { DAILY_MODEL_CALL_LIMIT, spendModelCall } from "./budget";
import {
  forgetModelCalls,
  modelCallDay,
  setModelCallCount,
} from "./repository";

/**
 * The budget as every caller sees it. There is one allowance per user per day
 * and three things that spend from it — job extraction, reading a CV, and an
 * Analysis — so what is worth proving here is that the budget cannot tell them
 * apart: three calls of three kinds drain one allowance, and the third is
 * refused because the first two were spent.
 *
 * The counter is a real row in the real table, cleared around each test. That
 * is the point of it: a budget that did not survive a request would not be one.
 */

beforeEach(clearCounters);
afterAll(clearCounters);

async function clearCounters(): Promise<void> {
  await forgetModelCalls(TEST_USER.id);
  await forgetModelCalls(OTHER_TEST_USER.id);
}

describe("the daily model call budget", () => {
  it("lets a call through while the allowance has room", async () => {
    expect(await spendModelCall(TEST_USER.id)).toBe("spent");
  });

  it("refuses a call once the allowance is gone", async () => {
    await setModelCallCount(TEST_USER.id, DAILY_MODEL_CALL_LIMIT);

    expect(await spendModelCall(TEST_USER.id)).toBe("over-limit");
  });

  it("spends the last of the allowance rather than refusing it", async () => {
    await setModelCallCount(TEST_USER.id, DAILY_MODEL_CALL_LIMIT - 1);

    expect(await spendModelCall(TEST_USER.id)).toBe("spent");
    expect(await spendModelCall(TEST_USER.id)).toBe("over-limit");
  });

  it("exhausts one allowance however many different callers spend from it", async () => {
    await setModelCallCount(TEST_USER.id, DAILY_MODEL_CALL_LIMIT - 3);

    // Three spends, not three callers: this function takes no argument saying
    // who is asking, which is exactly the property under test. Job extraction,
    // a CV reading and an Analysis spend through this one line, so three of
    // them in any combination leave nothing for a fourth.
    expect(await spendModelCall(TEST_USER.id)).toBe("spent");
    expect(await spendModelCall(TEST_USER.id)).toBe("spent");
    expect(await spendModelCall(TEST_USER.id)).toBe("spent");
    expect(await spendModelCall(TEST_USER.id)).toBe("over-limit");
  });

  it("keeps refusing once the allowance is over, rather than wrapping around", async () => {
    await setModelCallCount(TEST_USER.id, DAILY_MODEL_CALL_LIMIT);

    expect(await spendModelCall(TEST_USER.id)).toBe("over-limit");
    expect(await spendModelCall(TEST_USER.id)).toBe("over-limit");
  });

  it("gives each user their own allowance", async () => {
    await setModelCallCount(TEST_USER.id, DAILY_MODEL_CALL_LIMIT);

    expect(await spendModelCall(TEST_USER.id)).toBe("over-limit");
    expect(await spendModelCall(OTHER_TEST_USER.id)).toBe("spent");
  });

  it("gives each day its own allowance", async () => {
    const yesterday = modelCallDay(new Date(Date.now() - 24 * 60 * 60 * 1000));
    await setModelCallCount(TEST_USER.id, DAILY_MODEL_CALL_LIMIT, yesterday);

    try {
      expect(await spendModelCall(TEST_USER.id)).toBe("spent");
    } finally {
      await forgetModelCalls(TEST_USER.id, yesterday);
    }
  });
});

describe("the day a budget is keyed on", () => {
  it("is the UTC day, not the reader's", () => {
    // Late enough on the 31st in UTC+13 that a local reading would say the 1st.
    expect(modelCallDay(new Date("2026-01-31T23:30:00Z"))).toBe("2026-01-31");
  });
});
