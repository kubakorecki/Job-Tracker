import { describe, expect, it } from "vitest";
import { nearDuplicatesOf } from "./near-duplicates.js";

/** Enough of a Job Application to be a near-duplicate of another. */
const at = (company: string, jobTitle: string) => ({ company, jobTitle });

/** The titles the rule is asked about, one company throughout. */
function similar(a: string, b: string): boolean {
  return nearDuplicatesOf(at("Acme", a), [at("Acme", b)]).length === 1;
}

describe("nearDuplicatesOf", () => {
  it("finds nothing among no Job Applications", () => {
    expect(nearDuplicatesOf(at("Acme", "Engineer"), [])).toEqual([]);
  });

  it("returns the Job Applications themselves, so a caller can name them", () => {
    const existing = at("Acme", "Software Engineer");

    expect(
      nearDuplicatesOf(at("Acme", "Senior Software Engineer"), [existing]),
    ).toEqual([existing]);
  });

  it("treats an identical role at the same company as a near-duplicate", () => {
    expect(similar("Software Engineer", "Software Engineer")).toBe(true);
  });

  it("treats a title contained in a longer one as a near-duplicate", () => {
    expect(similar("Senior Software Engineer", "Software Engineer")).toBe(true);
    expect(
      similar("Software Engineer", "Staff Software Engineer, Growth"),
    ).toBe(true);
  });

  it("ignores case, punctuation and spacing in a title", () => {
    expect(similar("  software   engineer  ", "Software-Engineer")).toBe(true);
    expect(
      similar("Software Engineer (Backend)", "backend software engineer"),
    ).toBe(true);
  });

  it("ignores case and spacing in a company", () => {
    expect(
      nearDuplicatesOf(at(" ACME  Inc ", "Engineer"), [
        at("acme inc", "Engineer"),
      ]),
    ).toHaveLength(1);
  });

  it("keeps two different roles at one company apart", () => {
    expect(similar("Backend Engineer", "Frontend Engineer")).toBe(false);
    expect(similar("Software Engineer", "Product Designer")).toBe(false);
  });

  it("never hints across companies, however alike the titles", () => {
    expect(
      nearDuplicatesOf(at("Acme", "Software Engineer"), [
        at("Globex", "Software Engineer"),
      ]),
    ).toEqual([]);
  });

  it("finds every near-duplicate, not just the first", () => {
    expect(
      nearDuplicatesOf(at("Acme", "Software Engineer"), [
        at("Acme", "Senior Software Engineer"),
        at("Acme", "Product Designer"),
        at("Acme", "Software Engineer II"),
      ]),
    ).toHaveLength(2);
  });

  it("hints at nothing for a title or company the user has not typed yet", () => {
    expect(
      nearDuplicatesOf(at("", "Software Engineer"), [
        at("", "Software Engineer"),
      ]),
    ).toEqual([]);
    expect(
      nearDuplicatesOf(at("Acme", "  "), [at("Acme", "Engineer")]),
    ).toEqual([]);
  });
});
