import { describe, expect, it } from "vitest";
import { draftFrom, draftKey, writtenDraft } from "./draft";
import type { ActivityReport } from "./report";

/** The unsent draft, as browser storage hands it back. */

const report: ActivityReport = {
  month: "2026-09",
  language: "pl",
  notes: "Byłem na targach pracy.",
  rows: [
    {
      id: "first",
      employer: "Acme",
      link: "https://example.com/jobs/42",
      did: "5 września: Złożenie CV",
      back: "Brak odpowiedzi",
    },
  ],
};

describe("draftKey", () => {
  it("files a draft under its month and its language, which are two documents", () => {
    expect(draftKey("2026-09", "pl")).not.toBe(draftKey("2026-09", "en"));
    expect(draftKey("2026-09", "pl")).not.toBe(draftKey("2026-08", "pl"));
  });
});

describe("draftFrom", () => {
  it("reads back exactly what was written", () => {
    expect(draftFrom(writtenDraft(report), "2026-09", "pl")).toEqual(report);
  });

  it("is nothing where nothing was stored", () => {
    expect(draftFrom(null, "2026-09", "pl")).toBeNull();
  });

  it("is nothing rather than a page that throws, whatever is in the box", () => {
    expect(draftFrom("not json at all", "2026-09", "pl")).toBeNull();
    expect(draftFrom("[]", "2026-09", "pl")).toBeNull();
    expect(
      draftFrom(
        JSON.stringify({ ...report, rows: [{ id: "first" }] }),
        "2026-09",
        "pl",
      ),
    ).toBeNull();
  });

  it("refuses a draft filed under another month or another language", () => {
    expect(draftFrom(writtenDraft(report), "2026-08", "pl")).toBeNull();
    expect(draftFrom(writtenDraft(report), "2026-09", "en")).toBeNull();
  });
});
