import { describe, expect, it } from "vitest";
import { readDraft } from "./provider";

/**
 * Turning the provider's flat JSON into a Draft. This is the one piece of the
 * backend the API seam cannot reach: the endpoint's tests substitute the
 * extraction function, so they substitute this away with it. Everything else
 * about extraction is asserted through the endpoint.
 *
 * The flat schema has no nulls — Gemini rejects the schema shapes that would
 * express one — so "the page does not say" arrives as an empty string, a zero
 * or an empty array, and the whole of this file is about that translation.
 */

/** Every field filled in, as a page that says everything would come back. */
const COMPLETE = {
  company: "Acme",
  jobTitle: "Senior Engineer",
  location: "London",
  remoteType: "hybrid",
  salaryMin: 90000,
  salaryMax: 110000,
  currency: "GBP",
  description: "Building things at Acme.",
  keywords: ["TypeScript", "Postgres"],
};

/** Every field at its "the page does not say" value. */
const EMPTY = {
  company: "",
  jobTitle: "",
  location: "",
  remoteType: "",
  salaryMin: 0,
  salaryMax: 0,
  currency: "",
  description: "",
  keywords: [],
};

function read(reply: unknown) {
  return readDraft(JSON.stringify(reply));
}

describe("readDraft", () => {
  it("keeps every field a page stated", () => {
    expect(read(COMPLETE)).toEqual(COMPLETE);
  });

  it("carries nothing at all when the page stated nothing", () => {
    expect(read(EMPTY)).toEqual({});
  });

  it("drops only the fields the page left empty", () => {
    expect(read({ ...EMPTY, company: "Acme", jobTitle: "Engineer" })).toEqual({
      company: "Acme",
      jobTitle: "Engineer",
    });
  });

  it("treats whitespace as an empty field rather than a value", () => {
    expect(read({ ...EMPTY, company: "   ", jobTitle: "\n" })).toEqual({});
  });

  it("trims what it keeps", () => {
    expect(read({ ...EMPTY, company: "  Acme  " })).toEqual({
      company: "Acme",
    });
  });

  it("keeps a salary the page stated on one side only", () => {
    expect(read({ ...EMPTY, salaryMin: 50000 })).toEqual({ salaryMin: 50000 });
  });

  it("falls back on a field the model worded wrongly rather than losing the rest", () => {
    expect(
      read({ ...COMPLETE, remoteType: "occasionally", salaryMax: "lots" }),
    ).toEqual({
      ...COMPLETE,
      remoteType: undefined,
      salaryMax: undefined,
    });
  });

  it("fills in a field the model left out altogether", () => {
    const missingLocation: Record<string, unknown> = { ...COMPLETE };
    delete missingLocation.location;

    expect(read(missingLocation)).toEqual({
      ...COMPLETE,
      location: undefined,
    });
  });

  it("refuses a reply that is not an object at all", () => {
    expect(() => read("no job here")).toThrow();
  });

  it("refuses a reply that is not JSON", () => {
    expect(() => readDraft("<html>429 Too Many Requests</html>")).toThrow();
  });
});
