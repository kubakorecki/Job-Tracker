import type { JobApplication } from "@repo/schema";
import { describe, expect, it } from "vitest";
import {
  asRequirements,
  requirementChanges,
  requirementEditsFrom,
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
  currency: "USD",
  description: "Works on Basecamp and HEY.",
  requirements: [
    { skill: "Ruby", necessity: "required" },
    { skill: "Rails", necessity: "preferred" },
  ],
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
      { skill: "Ruby", necessity: "required" },
      { skill: "Ruby", necessity: "preferred" },
    ]);

    expect(new Set(rows.map(({ key }) => key)).size).toBe(2);
  });

  it("holds no rows for a Job Application nothing has asked anything of", () => {
    expect(requirementEditsFrom([])).toEqual([]);
  });
});

describe("asRequirements", () => {
  it("gives back what the rows say, as the contract states a Requirement", () => {
    expect(asRequirements(requirementEditsFrom(SAVED.requirements))).toEqual(
      SAVED.requirements,
    );
  });

  it("trims a skill, so a stray space is not a correction", () => {
    const [row] = requirementEditsFrom([
      { skill: "Ruby", necessity: "required" },
    ]);

    expect(asRequirements([{ ...row!, skill: "  Ruby  " }])).toEqual([
      { skill: "Ruby", necessity: "required" },
    ]);
  });

  it("keeps a skill the user emptied, so the contract gets to name the problem", () => {
    const [row] = requirementEditsFrom([
      { skill: "Ruby", necessity: "required" },
    ]);

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
    const added = [
      ...rows,
      { key: "new", skill: "Postgres", necessity: "required" as const },
    ];

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
