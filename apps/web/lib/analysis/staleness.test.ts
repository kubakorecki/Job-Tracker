import type { JobStatus } from "@repo/schema";
import { describe, expect, it } from "vitest";
import { isStale } from "./staleness";

/**
 * When an Analysis has stopped describing the world, and when saying so is
 * worth the user's attention. Both are arithmetic over four values, so both
 * are tested here rather than through the endpoint that reads them.
 */

const RAN_AT = new Date("2026-09-01T12:00:00Z");
const BEFORE = new Date("2026-08-31T12:00:00Z");
const AFTER = new Date("2026-09-02T12:00:00Z");

/** An Analysis that still stands, for a test to move one thing under. */
const CURRENT = {
  ranAt: RAN_AT,
  profileChangedAt: BEFORE,
  requirementsChangedAt: BEFORE,
  status: "bookmarked",
} satisfies Parameters<typeof isStale>[0];

describe("what makes an Analysis stale", () => {
  it("stands while nothing has moved under it", () => {
    expect(isStale(CURRENT)).toBe(false);
  });

  it("goes stale when the Profile changed after it ran", () => {
    expect(isStale({ ...CURRENT, profileChangedAt: AFTER })).toBe(true);
  });

  it("goes stale when the Requirements changed after it ran", () => {
    expect(isStale({ ...CURRENT, requirementsChangedAt: AFTER })).toBe(true);
  });

  it("stands when the Profile moved at the very moment it ran", () => {
    // The run reads the Profile and stamps itself afterwards, so equal stamps
    // are the ordinary outcome of one Analysis rather than a change under it.
    expect(isStale({ ...CURRENT, profileChangedAt: RAN_AT })).toBe(false);
  });

  it("stands for a Job Application whose Requirements it read and nobody has touched", () => {
    expect(isStale({ ...CURRENT, requirementsChangedAt: RAN_AT })).toBe(false);
  });

  it("stands where there is neither a Profile nor a Requirement to have moved", () => {
    // Nothing carrying a later stamp is nothing that changed. Neither state is
    // reachable while an Analysis exists — a CV is replaced rather than
    // removed — and answering "stale" to them would be inventing a change.
    expect(
      isStale({
        ...CURRENT,
        profileChangedAt: null,
        requirementsChangedAt: null,
      }),
    ).toBe(false);
  });
});

describe("when staleness is worth saying", () => {
  it.each(["bookmarked", "applied"] as const)(
    "says so while the Status is %s",
    (status: JobStatus) => {
      expect(isStale({ ...CURRENT, profileChangedAt: AFTER, status })).toBe(
        true,
      );
    },
  );

  it.each(["interviewing", "offer", "rejected", "withdrawn"] as const)(
    "keeps quiet once the Status is %s",
    (status: JobStatus) => {
      expect(isStale({ ...CURRENT, profileChangedAt: AFTER, status })).toBe(
        false,
      );
    },
  );
});
