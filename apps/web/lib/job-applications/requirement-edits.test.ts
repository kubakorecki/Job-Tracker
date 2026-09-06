import type { JobApplication } from "@repo/schema";
import { describe, expect, it } from "vitest";
import { asked } from "../test-support/requirements";
import {
  asRequirements,
  newRequirementEdit,
  requirementChanges,
  requirementEditsFrom,
  withReadings,
} from "./requirement-edits";

/**
 * The Requirements section's arithmetic, with no form in sight: a Job
 * Application's asks as rows a list of controls can hold, and what those rows
 * amount to once the user has finished correcting them.
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
  closesOn: null,
  currency: "USD",
  description: "Works on Basecamp and HEY.",
  requirements: [asked("Ruby", "required"), asked("Rails", "preferred")],
  status: "applied",
  source: "referral",
  appliedAt: "2026-02-14T10:30:00.000Z",
  excitement: 4,
  notes: "Second interview on the 9th.",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("requirementEditsFrom", () => {
  it("holds a Job Application's Requirements in the order it carries them", () => {
    expect(requirementEditsFrom(SAVED.requirements)).toMatchObject([
      { skill: "Ruby", necessity: "required" },
      { skill: "Rails", necessity: "preferred" },
    ]);
  });

  it("gives every row a key of its own, so a correction cannot be mistaken for its neighbour", () => {
    // A Requirement has no identity in the contract — the skill is what
    // identifies it, and the skill is the thing a correction changes. The list
    // needs something stabler than that to hold a row still while it is edited.
    const rows = requirementEditsFrom([
      asked("Ruby", "required"),
      asked("Ruby", "preferred"),
    ]);

    expect(new Set(rows.map(({ key }) => key)).size).toBe(2);
  });

  it("holds no rows for a Job Application nothing has asked anything of", () => {
    expect(requirementEditsFrom([])).toEqual([]);
  });
});

describe("withReadings", () => {
  const [row] = requirementEditsFrom([
    asked("Ruby", "required", {
      coverage: "missing",
      normalisedCoverage: "missing",
    }),
  ]);

  /** The Requirement as it comes back once the user has overruled it. */
  const overridden = {
    ...asked("Ruby", "required", {
      coverage: "have",
      normalisedCoverage: "missing",
      overriddenCoverage: "have",
    }),
    id: row!.id!,
  };

  it("takes the readings the write answered with", () => {
    expect(withReadings(row!, overridden)).toMatchObject({
      coverage: "have",
      normalisedCoverage: "missing",
      overriddenCoverage: "have",
    });
  });

  it("leaves the wording the user is part-way through typing alone", () => {
    // The write was about the verdict. Reaching back into the box would undo a
    // correction the user has not finished making.
    const typing = { ...row!, skill: "Ruby on Ra" };

    expect(withReadings(typing, overridden)).toMatchObject({
      key: typing.key,
      skill: "Ruby on Ra",
      necessity: "required",
    });
  });
});

describe("newRequirementEdit", () => {
  it("has no id, because the server has never heard of it", () => {
    // Which is what the override control reads to know there is no Requirement
    // yet for a verdict to be about.
    expect(
      newRequirementEdit({ skill: "Postgres", necessity: "required" }),
    ).toMatchObject({ id: null, skill: "Postgres", coverage: null });
  });
});

describe("asRequirements", () => {
  it("gives back what the rows say, as the contract states a Requirement", () => {
    // The Coverage readings the rows carry are no part of it: a patch states
    // what the Posting asks for, and how a CV answers that is not the user's
    // to send.
    expect(asRequirements(requirementEditsFrom(SAVED.requirements))).toEqual([
      { skill: "Ruby", necessity: "required" },
      { skill: "Rails", necessity: "preferred" },
    ]);
  });

  it("trims a skill, so a stray space is not a correction", () => {
    const [row] = requirementEditsFrom([asked("Ruby", "required")]);

    expect(asRequirements([{ ...row!, skill: "  Ruby  " }])).toEqual([
      { skill: "Ruby", necessity: "required" },
    ]);
  });

  it("keeps a skill the user emptied, so the contract gets to name the problem", () => {
    const [row] = requirementEditsFrom([asked("Ruby", "required")]);

    expect(asRequirements([{ ...row!, skill: "" }])).toEqual([
      { skill: "", necessity: "required" },
    ]);
  });
});

describe("requirementChanges", () => {
  const rows = requirementEditsFrom(SAVED.requirements);

  it("names nothing when the Requirements are as they were saved", () => {
    expect(requirementChanges(rows, SAVED)).toEqual({});
  });

  it("names nothing when only the spacing around a skill moved", () => {
    const spaced = rows.map((row) => ({ ...row, skill: ` ${row.skill} ` }));

    expect(requirementChanges(spaced, SAVED)).toEqual({});
  });

  it("states the whole list when a Requirement was added", () => {
    const added = [...rows, newRequirementEdit(asked("Postgres", "required"))];

    expect(requirementChanges(added, SAVED)).toEqual({
      requirements: [
        { skill: "Ruby", necessity: "required" },
        { skill: "Rails", necessity: "preferred" },
        { skill: "Postgres", necessity: "required" },
      ],
    });
  });

  it("states the whole list when a Requirement was removed", () => {
    expect(requirementChanges(rows.slice(0, 1), SAVED)).toEqual({
      requirements: [{ skill: "Ruby", necessity: "required" }],
    });
  });

  it("states the whole list when a skill's wording changed", () => {
    const corrected = rows.map((row) =>
      row.skill === "Rails" ? { ...row, skill: "Ruby on Rails" } : row,
    );

    expect(requirementChanges(corrected, SAVED)).toEqual({
      requirements: [
        { skill: "Ruby", necessity: "required" },
        { skill: "Ruby on Rails", necessity: "preferred" },
      ],
    });
  });

  it("states the whole list when a Necessity changed", () => {
    const rephrased = rows.map((row) =>
      row.skill === "Rails" ? { ...row, necessity: "unstated" as const } : row,
    );

    expect(requirementChanges(rephrased, SAVED)).toEqual({
      requirements: [
        { skill: "Ruby", necessity: "required" },
        { skill: "Rails", necessity: "unstated" },
      ],
    });
  });

  it("states an empty list when the last Requirement was removed", () => {
    // Distinct from naming nothing: one clears the Requirements, the other
    // leaves them alone, and the endpoint reads the difference.
    expect(requirementChanges([], SAVED)).toEqual({ requirements: [] });
  });

  it("names nothing when a Job Application with no Requirements still has none", () => {
    expect(requirementChanges([], { ...SAVED, requirements: [] })).toEqual({});
  });
});
