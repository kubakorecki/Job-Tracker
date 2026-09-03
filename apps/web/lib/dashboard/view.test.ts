import { describe, expect, it } from "vitest";
import { viewFrom } from "./view";

/**
 * The remembered view, as it comes back out of browser storage — which holds
 * strings, and holds whatever was in it before this code existed.
 */
describe("viewFrom", () => {
  it("reads back each view the user can choose", () => {
    expect(viewFrom("board")).toBe("board");
    expect(viewFrom("table")).toBe("table");
  });

  it("starts a user with no stored preference on the board", () => {
    expect(viewFrom(null)).toBe("board");
  });

  it("falls back to the board rather than trusting anything else stored there", () => {
    expect(viewFrom("kanban")).toBe("board");
    expect(viewFrom("")).toBe("board");
  });
});
