import { describe, expect, it } from "vitest";
import { laneAt } from "./lane";

/** Three columns 100 wide with a 14 gap between each, as the board lays them. */
const lanes = [
  { id: "BOOKMARKED", left: 0, right: 100 },
  { id: "APPLIED", left: 114, right: 214 },
  { id: "INTERVIEWING", left: 228, right: 328 },
];

describe("laneAt", () => {
  it("is the column the card is across from", () => {
    expect(laneAt(50, lanes)).toBe("BOOKMARKED");
    expect(laneAt(150, lanes)).toBe("APPLIED");
    expect(laneAt(300, lanes)).toBe("INTERVIEWING");
  });

  it("counts a column's edges as part of it", () => {
    expect(laneAt(114, lanes)).toBe("APPLIED");
    expect(laneAt(214, lanes)).toBe("APPLIED");
  });

  it("takes the nearer column when the card is in the gap between two", () => {
    expect(laneAt(104, lanes)).toBe("BOOKMARKED");
    expect(laneAt(110, lanes)).toBe("APPLIED");
  });

  it("takes the end column when the card is off either end of the board", () => {
    expect(laneAt(-40, lanes)).toBe("BOOKMARKED");
    expect(laneAt(900, lanes)).toBe("INTERVIEWING");
  });

  it("is nothing when there are no columns", () => {
    expect(laneAt(50, [])).toBeUndefined();
  });
});
