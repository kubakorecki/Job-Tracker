import { describe, expect, it } from "vitest";
import { periodFrom } from "./period";

/**
 * The remembered Salary Period, as it comes back out of browser storage —
 * which holds strings, and holds whatever was in it before this code existed.
 */
describe("periodFrom", () => {
  it("reads back each period the user can choose", () => {
    expect(periodFrom("annual")).toBe("annual");
    expect(periodFrom("monthly")).toBe("monthly");
    expect(periodFrom("daily")).toBe("daily");
    expect(periodFrom("hourly")).toBe("hourly");
  });

  it("starts a user with no stored preference on month", () => {
    expect(periodFrom(null)).toBe("monthly");
  });

  it("falls back to month rather than trusting anything else stored there", () => {
    expect(periodFrom("weekly")).toBe("monthly");
    expect(periodFrom("month")).toBe("monthly");
    expect(periodFrom("")).toBe("monthly");
  });
});
