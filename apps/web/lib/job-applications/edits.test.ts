import type { JobApplication } from "@repo/schema";
import { describe, expect, it } from "vitest";
import { asked } from "../test-support/requirements";
import { changeFrom, changesFrom, editsFrom } from "./edits";

/**
 * The detail view's arithmetic, with no form and no database in sight: what a
 * Job Application looks like as text a form can hold, and what a patch made of
 * that text says once the user has finished with it.
 */

const SAVED: JobApplication = {
  id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  userId: "00000000-0000-4000-8000-000000000001",
  company: "Basecamp",
  jobTitle: "Programmer",
  jobUrl: "https://basecamp.com/jobs/programmer",
  location: "Chicago",
  remoteType: "hybrid",
  salaryMin: 120000,
  salaryMax: 160000,
  salaryPeriod: "annual",
  currency: "USD",
  description: "Works on Basecamp and HEY.",
  closesOn: "2026-03-31",
  requirements: [asked("ruby", "required")],
  interviews: [],
  status: "applied",
  source: "referral",
  appliedAt: "2026-02-14T10:30:00.000Z",
  excitement: 4,
  notes: "Second interview on the 9th.",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("editsFrom", () => {
  it("renders every field of a Job Application as text a form can hold", () => {
    expect(editsFrom(SAVED)).toEqual({
      company: "Basecamp",
      jobTitle: "Programmer",
      jobUrl: "https://basecamp.com/jobs/programmer",
      location: "Chicago",
      remoteType: "hybrid",
      salaryMin: "120000",
      salaryMax: "160000",
      salaryPeriod: "annual",
      currency: "USD",
      description: "Works on Basecamp and HEY.",
      closesOn: "2026-03-31",
      status: "applied",
      source: "referral",
      appliedAt: "2026-02-14",
      excitement: "4",
      notes: "Second interview on the 9th.",
    });
  });

  it("renders every unset field as an empty box rather than the word null", () => {
    const bare: JobApplication = {
      ...SAVED,
      jobUrl: null,
      location: null,
      remoteType: null,
      salaryMin: null,
      salaryMax: null,
      salaryPeriod: null,
      currency: null,
      description: null,
      closesOn: null,
      requirements: [],
      source: null,
      appliedAt: null,
      excitement: null,
      notes: null,
    };

    expect(editsFrom(bare)).toMatchObject({
      jobUrl: "",
      location: "",
      remoteType: "",
      salaryMin: "",
      salaryMax: "",
      salaryPeriod: "",
      currency: "",
      description: "",
      closesOn: "",
      source: "",
      appliedAt: "",
      excitement: "",
      notes: "",
    });
  });
});

describe("changesFrom", () => {
  it("names nothing when the user changed nothing", () => {
    expect(changesFrom(editsFrom(SAVED), SAVED)).toEqual({});
  });

  it("names only the fields the user actually touched", () => {
    const edits = { ...editsFrom(SAVED), notes: "Offer expected Friday." };

    expect(changesFrom(edits, SAVED)).toEqual({
      notes: "Offer expected Friday.",
    });
  });

  it("clears a field the user emptied", () => {
    const edits = { ...editsFrom(SAVED), location: "", excitement: "" };

    expect(changesFrom(edits, SAVED)).toEqual({
      location: null,
      excitement: null,
    });
  });

  it("carries a Closing Date the user moved, as the day it is", () => {
    const edits = { ...editsFrom(SAVED), closesOn: "2026-04-15" };

    expect(changesFrom(edits, SAVED)).toEqual({ closesOn: "2026-04-15" });
  });

  it("clears a Closing Date the user emptied", () => {
    const edits = { ...editsFrom(SAVED), closesOn: "" };

    expect(changesFrom(edits, SAVED)).toEqual({ closesOn: null });
  });

  it("reads salary and excitement as numbers", () => {
    const edits = { ...editsFrom(SAVED), salaryMin: "130000", excitement: "5" };

    expect(changesFrom(edits, SAVED)).toEqual({
      salaryMin: 130000,
      excitement: 5,
    });
  });

  it("reads a date the user picked as an applied date", () => {
    const edits = { ...editsFrom(SAVED), appliedAt: "2025-11-20" };

    expect(changesFrom(edits, SAVED)).toEqual({
      appliedAt: "2025-11-20T00:00:00.000Z",
    });
  });

  it("leaves an applied date alone when the user did not touch the day it names", () => {
    // The box holds a day; the stored date holds a time too. Saving an
    // untouched form must not quietly move the date back to midnight.
    expect(changesFrom(editsFrom(SAVED), SAVED).appliedAt).toBeUndefined();
  });

  it("never speaks for the Requirements, which no box on the form holds", () => {
    // They carry a Necessity each, so they have their own control and their
    // own patch; a form's worth of text has nothing to say about them.
    expect(changesFrom(editsFrom(SAVED), SAVED)).not.toHaveProperty(
      "requirements",
    );
  });

  it("trims what the user typed", () => {
    const edits = { ...editsFrom(SAVED), company: "  37signals  " };

    expect(changesFrom(edits, SAVED)).toEqual({ company: "37signals" });
  });

  it("keeps a change the shared contract will refuse, so the contract can say why", () => {
    expect(changesFrom({ ...editsFrom(SAVED), company: "" }, SAVED)).toEqual({
      company: "",
    });
  });
});

describe("changeFrom", () => {
  it("names the one field, so a control that saves itself cannot carry the rest of the form with it", () => {
    expect(changeFrom("excitement", "4")).toEqual({ excitement: 4 });
  });

  it("puts a cleared rating back to nothing rather than leaving it out", () => {
    expect(changeFrom("excitement", "")).toEqual({ excitement: null });
  });

  it("converts through the same table a whole-form save does", () => {
    expect(changeFrom("company", "  Basecamp  ")).toEqual({
      company: "Basecamp",
    });
    expect(changeFrom("location", "   ")).toEqual({ location: null });
  });
});
