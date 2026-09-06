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
 * Requirements arrive as three arrays of bare strings, one per Necessity,
 * because a tagged list is the nested shape the schema cannot ask for; folding
 * them back into one is the other half of the same translation.
 */

/**
 * The fields the translation does nothing to but copy, as a page that states
 * every one of them would come back. Shared by the reply and the Draft below,
 * so that the one field the translation actually works on is the only thing
 * written twice.
 */
const COPIED = {
  company: "Acme",
  jobTitle: "Senior Engineer",
  location: "London",
  remoteType: "hybrid",
  salaryMin: 90000,
  salaryMax: 110000,
  salaryPeriod: "annual",
  currency: "GBP",
  description: "Building things at Acme.",
  closesOn: "2026-09-30",
};

/** Every field filled in, including a skill of each Necessity. */
const COMPLETE = {
  ...COPIED,
  requiredSkills: ["TypeScript", "Postgres"],
  preferredSkills: ["Terraform"],
  unstatedSkills: ["Agile"],
};

/**
 * `COMPLETE` as a Draft. The three arrays become one list, each Requirement
 * carrying the Necessity of the array it came out of, hard ones first.
 */
const COMPLETE_DRAFT = {
  ...COPIED,
  requirements: [
    { skill: "TypeScript", necessity: "required" },
    { skill: "Postgres", necessity: "required" },
    { skill: "Terraform", necessity: "preferred" },
    { skill: "Agile", necessity: "unstated" },
  ],
};

/** Every field at its "the page does not say" value. */
const EMPTY = {
  company: "",
  jobTitle: "",
  location: "",
  remoteType: "",
  salaryMin: 0,
  salaryMax: 0,
  salaryPeriod: "",
  currency: "",
  description: "",
  closesOn: "",
  requiredSkills: [],
  preferredSkills: [],
  unstatedSkills: [],
};

function read(reply: unknown) {
  return readDraft(JSON.stringify(reply));
}

describe("readDraft", () => {
  it("keeps every field a page stated", () => {
    expect(read(COMPLETE)).toEqual(COMPLETE_DRAFT);
  });

  it("marks each Requirement with the Necessity of the list it came in", () => {
    expect(read(COMPLETE).requirements).toEqual(COMPLETE_DRAFT.requirements);
  });

  it("makes a Requirement of a skill the page named without saying how badly it wanted it", () => {
    expect(read({ ...EMPTY, unstatedSkills: ["Terraform"] })).toEqual({
      requirements: [{ skill: "Terraform", necessity: "unstated" }],
    });
  });

  it("keeps no Requirement the model worded as blank or whitespace", () => {
    expect(
      read({ ...EMPTY, requiredSkills: ["  Kubernetes  ", "", "   "] }),
    ).toEqual({
      requirements: [{ skill: "Kubernetes", necessity: "required" }],
    });
  });

  it("carries no Requirements at all when every one came back blank", () => {
    // Absent, not empty — the same answer every other field gives for a page
    // that did not say. A Job Application made from it has no Requirements,
    // which is a Posting that asked for nothing rather than a failure.
    expect(read({ ...EMPTY, preferredSkills: ["", "  "] })).toEqual({});
  });

  it("carries no Requirements at all when the page asked for nothing", () => {
    expect(read({ ...EMPTY, company: "Acme" })).toEqual({ company: "Acme" });
  });

  it("falls back on one Necessity the model worded wrongly rather than losing the others", () => {
    expect(
      read({ ...EMPTY, requiredSkills: "TypeScript", preferredSkills: ["Go"] }),
    ).toEqual({
      requirements: [{ skill: "Go", necessity: "preferred" }],
    });
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

  it("keeps the period a salary was quoted over rather than a year's worth", () => {
    // The whole of what the Polish market states, and the reason the period is
    // carried at all: 17 000 a month is not 17 000, and annualising it here
    // would be arithmetic nothing downstream could tell from the page's words.
    expect(
      read({
        ...EMPTY,
        salaryMin: 17000,
        salaryMax: 26090,
        salaryPeriod: "monthly",
        currency: "PLN",
      }),
    ).toEqual({
      salaryMin: 17000,
      salaryMax: 26090,
      salaryPeriod: "monthly",
      currency: "PLN",
    });
  });

  it("carries no period for a page that stated no salary", () => {
    expect(read({ ...EMPTY, company: "Acme" })).toEqual({ company: "Acme" });
  });

  it("falls back on a period the model worded wrongly rather than losing the figures", () => {
    expect(read({ ...COMPLETE, salaryPeriod: "per fortnight" })).toEqual({
      ...COMPLETE_DRAFT,
      salaryPeriod: undefined,
    });
  });

  it("keeps a Closing Date the page stated, as the day it is", () => {
    expect(read({ ...EMPTY, closesOn: "2026-09-30" })).toEqual({
      closesOn: "2026-09-30",
    });
  });

  it("carries no Closing Date for a page that stated none", () => {
    expect(read({ ...EMPTY, company: "Acme" })).toEqual({ company: "Acme" });
  });

  it("drops a Closing Date the model worded as anything but a calendar day", () => {
    // Anything the contract would refuse has to go here rather than travel to
    // a form that cannot save: the review form holds this in a date box, and a
    // box holding "in 5 days" would be a Draft the user could not correct
    // without knowing what the model had put there.
    for (const worded of ["in 5 days", "30/09/2026", "September", "2026-13-40"]) {
      expect(read({ ...COMPLETE, closesOn: worded })).toEqual({
        ...COMPLETE_DRAFT,
        closesOn: undefined,
      });
    }
  });

  it("falls back on a field the model worded wrongly rather than losing the rest", () => {
    expect(
      read({ ...COMPLETE, remoteType: "occasionally", salaryMax: "lots" }),
    ).toEqual({
      ...COMPLETE_DRAFT,
      remoteType: undefined,
      salaryMax: undefined,
    });
  });

  it("fills in a field the model left out altogether", () => {
    const missingLocation: Record<string, unknown> = { ...COMPLETE };
    delete missingLocation.location;

    expect(read(missingLocation)).toEqual({
      ...COMPLETE_DRAFT,
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
