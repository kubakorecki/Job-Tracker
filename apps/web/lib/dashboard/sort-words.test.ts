import { describe, expect, it } from "vitest";
import {
  ariaSortOf,
  BOARD_SORT_OPTIONS,
  boardSortOf,
  headingAction,
} from "./sort-words";

describe("headingAction", () => {
  it("offers a column's natural direction when nothing is sorted", () => {
    expect(headingAction(null, "salary")).toBe("Sort by Salary, highest first");
    expect(headingAction(null, "company")).toBe("Sort by Company, A to Z");
  });

  it("offers the natural direction when another column is sorted", () => {
    expect(
      headingAction({ column: "salary", direction: "descending" }, "closes"),
    ).toBe("Sort by Closes, earliest first");
  });

  it("offers the reverse once the column is sorted its natural way", () => {
    expect(
      headingAction({ column: "salary", direction: "descending" }, "salary"),
    ).toBe("Sort by Salary, lowest first");
    expect(
      headingAction({ column: "jobTitle", direction: "ascending" }, "jobTitle"),
    ).toBe("Sort by Job title, Z to A");
  });

  it("offers to go back to newest added once the column is reversed", () => {
    expect(
      headingAction({ column: "silence", direction: "ascending" }, "silence"),
    ).toBe("Stop sorting by Silence, back to newest added");
  });
});

describe("ariaSortOf", () => {
  it("names the direction on the sorted column", () => {
    const sort = { column: "salary", direction: "descending" } as const;
    expect(ariaSortOf(sort, "salary")).toBe("descending");
  });

  it("leaves every other heading without one", () => {
    const sort = { column: "salary", direction: "descending" } as const;
    expect(ariaSortOf(sort, "company")).toBeUndefined();
    expect(ariaSortOf(null, "company")).toBeUndefined();
  });
});

describe("BOARD_SORT_OPTIONS", () => {
  it("offers newest added, then every column but Status both ways, natural first", () => {
    expect(BOARD_SORT_OPTIONS.map(({ label }) => label)).toEqual([
      "Newest added",
      "Company, A to Z",
      "Company, Z to A",
      "Job title, A to Z",
      "Job title, Z to A",
      "Location, A to Z",
      "Location, Z to A",
      "Salary, highest first",
      "Salary, lowest first",
      "Fit, highest first",
      "Fit, lowest first",
      "Silence, most days first",
      "Silence, fewest days first",
      "Closes, earliest first",
      "Closes, latest first",
      "Excitement, highest first",
      "Excitement, lowest first",
    ]);
  });

  it("carries each sort itself", () => {
    const labelled = (label: string) =>
      BOARD_SORT_OPTIONS.find((option) => option.label === label)?.sort;

    expect(labelled("Newest added")).toBeNull();
    expect(labelled("Salary, lowest first")).toEqual({
      column: "salary",
      direction: "ascending",
    });
  });
});

describe("boardSortOf", () => {
  it("is the sort itself for any column the board offers", () => {
    const sort = { column: "closes", direction: "descending" } as const;
    expect(boardSortOf(sort)).toEqual(sort);
    expect(boardSortOf(null)).toBeNull();
  });

  it("reads a sort on Status as newest added, since Status is already the board's columns", () => {
    expect(
      boardSortOf({ column: "status", direction: "descending" }),
    ).toBeNull();
  });
});
