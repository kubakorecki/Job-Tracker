import { describe, expect, it } from "vitest";
import { hideClosedFrom } from "./closed";

/** The remembered choice, as it comes back out of browser storage. */
describe("hideClosedFrom", () => {
  it("reads back either choice the user can make", () => {
    expect(hideClosedFrom("true")).toBe(true);
    expect(hideClosedFrom("false")).toBe(false);
  });

  it("shows everything to a user with no stored preference", () => {
    expect(hideClosedFrom(null)).toBe(false);
  });

  it("shows everything rather than trusting anything else stored there", () => {
    expect(hideClosedFrom("yes")).toBe(false);
    expect(hideClosedFrom("")).toBe(false);
  });
});
