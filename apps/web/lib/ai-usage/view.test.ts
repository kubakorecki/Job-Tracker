import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { OTHER_TEST_USER, TEST_USER } from "../test-support/users";
import { MONTHLY_AI_USAGE_LIMIT } from "./meter";
import { forgetAiUsage, recordAiUsage, setAiUsage } from "./repository";
import { readAiUsage } from "./view";

/**
 * The meter as the Profile page reads it: a real row, through the repository,
 * with the wording `reading.test.ts` proves in isolation. What is worth
 * standing a database up for is only the wiring — that the page reads this
 * user's month and nobody else's, and that a month with no row is a reading
 * rather than an absence.
 */

beforeEach(clearMeters);
afterAll(clearMeters);

async function clearMeters(): Promise<void> {
  await forgetAiUsage(TEST_USER.id);
  await forgetAiUsage(OTHER_TEST_USER.id);
}

describe("reading a user's month", () => {
  it("reads a month nothing has touched as nothing spent", async () => {
    const reading = await readAiUsage(TEST_USER.id);

    expect(reading.spent).toBe(0);
    expect(reading.percent).toBe(0);
    expect(reading.isSpent).toBe(false);
  });

  it("reads what the calls of this month have recorded", async () => {
    await recordAiUsage(TEST_USER.id, 12_000);
    await recordAiUsage(TEST_USER.id, 8_000);

    expect((await readAiUsage(TEST_USER.id)).spent).toBe(20_000);
  });

  it("reads a spent month as spent", async () => {
    await setAiUsage(TEST_USER.id, MONTHLY_AI_USAGE_LIMIT);

    expect((await readAiUsage(TEST_USER.id)).isSpent).toBe(true);
  });

  it("reads each user's own meter", async () => {
    await setAiUsage(TEST_USER.id, MONTHLY_AI_USAGE_LIMIT);

    expect((await readAiUsage(OTHER_TEST_USER.id)).spent).toBe(0);
  });
});
