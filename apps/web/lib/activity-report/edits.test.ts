import { describe, expect, it } from "vitest";
import {
  blankRow,
  sameReport,
  withCell,
  withNotes,
  withoutRow,
  withRowAdded,
} from "./edits";
import type { ActivityReport } from "./report";

/** What the user does to a proposed report before it is printed. */

const report = (): ActivityReport => ({
  month: "2026-09",
  language: "pl",
  notes: "",
  rows: [
    {
      id: "first",
      employer: "Acme",
      link: "https://example.com/jobs/42",
      did: "5 września: Złożenie CV",
      back: "Brak odpowiedzi",
    },
    {
      id: "second",
      employer: "Globex",
      link: "",
      did: "",
      back: "12 września: Odmowa",
    },
  ],
});

describe("withCell", () => {
  it("rewords the one cell and leaves everything else standing", () => {
    const edited = withCell(report(), "second", "did", "Rozmowa telefoniczna");

    expect(edited.rows[1]?.did).toBe("Rozmowa telefoniczna");
    expect(edited.rows[1]?.back).toBe("12 września: Odmowa");
    expect(edited.rows[0]).toEqual(report().rows[0]);
  });

  it("leaves the report it was given alone", () => {
    const before = report();
    withCell(before, "first", "employer", "Something else");

    expect(before.rows[0]?.employer).toBe("Acme");
  });
});

describe("withNotes", () => {
  it("writes under the table", () => {
    expect(withNotes(report(), "Byłem na targach pracy.").notes).toBe(
      "Byłem na targach pracy.",
    );
  });
});

describe("withRowAdded", () => {
  it("puts an empty row last, where a row with no day of its own belongs", () => {
    const added = withRowAdded(report(), "added");

    expect(added.rows).toHaveLength(3);
    expect(added.rows[2]).toEqual(blankRow("added"));
  });
});

describe("withoutRow", () => {
  it("takes one row out and leaves the order of the rest", () => {
    const left = withoutRow(report(), "first");

    expect(left.rows.map((row) => row.id)).toEqual(["second"]);
  });

  it("changes nothing where no row has that id", () => {
    expect(withoutRow(report(), "nobody").rows).toHaveLength(2);
  });
});

describe("sameReport", () => {
  it("is true of a report nobody has touched", () => {
    expect(sameReport(report(), report())).toBe(true);
  });

  it("is false once a cell, a note or a row has moved", () => {
    expect(
      sameReport(report(), withCell(report(), "first", "back", "Odmowa")),
    ).toBe(false);
    expect(sameReport(report(), withNotes(report(), "x"))).toBe(false);
    expect(sameReport(report(), withRowAdded(report(), "added"))).toBe(false);
    expect(sameReport(report(), withoutRow(report(), "first"))).toBe(false);
  });
});
