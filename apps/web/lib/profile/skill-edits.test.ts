import { describe, expect, it } from "vitest";
import {
  asSkills,
  newSkillEdit,
  skillEditsFrom,
  skillsChanged,
} from "./skill-edits";

/**
 * The skill list's arithmetic, with no page in sight: a list of skills as rows
 * a column of boxes can hold, and what those rows amount to once the user has
 * finished correcting them.
 *
 * The same rows serve both lists the Profile page shows — the Draft the model
 * proposed and the list the user has already accepted — because reviewing a
 * proposal and editing the accepted list are the same act on the same shape.
 */

const ACCEPTED = ["TypeScript", "Postgres"];

describe("skillEditsFrom", () => {
  it("holds the skills in the order the list carries them", () => {
    expect(skillEditsFrom(ACCEPTED)).toMatchObject([
      { skill: "TypeScript" },
      { skill: "Postgres" },
    ]);
  });

  it("gives every row a key of its own, so a correction cannot be mistaken for its neighbour", () => {
    // A Skill has no identity beyond its own wording, and its wording is
    // precisely what a correction changes. Without a key of its own, editing
    // "Ruby" into "Rust" would look to React like a different row arriving in
    // the same place.
    const rows = skillEditsFrom(["Ruby", "Ruby"]);

    expect(new Set(rows.map(({ key }) => key)).size).toBe(2);
  });

  it("holds no rows for a Profile with nothing accepted yet", () => {
    expect(skillEditsFrom([])).toEqual([]);
  });
});

describe("newSkillEdit", () => {
  it("makes a row for a skill the user has just typed", () => {
    expect(newSkillEdit("Rust")).toMatchObject({ skill: "Rust" });
  });

  it("makes an empty row, for a box the user is about to type into", () => {
    expect(newSkillEdit("")).toMatchObject({ skill: "" });
  });

  it("keys each row apart from every other", () => {
    expect(newSkillEdit("Rust").key).not.toBe(newSkillEdit("Rust").key);
  });
});

describe("asSkills", () => {
  it("gives back what the rows say", () => {
    expect(asSkills(skillEditsFrom(ACCEPTED))).toEqual(ACCEPTED);
  });

  it("trims a skill, so a stray space is not a correction", () => {
    expect(asSkills([newSkillEdit("  TypeScript  ")])).toEqual(["TypeScript"]);
  });

  it("drops a row the user emptied, because clearing a box is how a row is taken away", () => {
    // Unlike a Requirement, a row here is one box and nothing else: an empty
    // one is not a half-filled record the contract should complain about, it
    // is a skill the user no longer claims.
    expect(asSkills([newSkillEdit("TypeScript"), newSkillEdit("   ")])).toEqual(
      ["TypeScript"],
    );
  });

  it("leaves a duplicate for the endpoint's tidier to fold away", () => {
    // `tidySkills` is the one place that decides two spellings are one skill,
    // and it runs on the server for the model's proposal and the user's edit
    // alike. Folding here as well would be a second copy of that rule.
    expect(asSkills(skillEditsFrom(["React", "react"]))).toEqual([
      "React",
      "react",
    ]);
  });

  it("says nothing when every row was cleared", () => {
    expect(asSkills([newSkillEdit(""), newSkillEdit(" ")])).toEqual([]);
  });
});

describe("skillsChanged", () => {
  const rows = skillEditsFrom(ACCEPTED);

  it("sees no change when the rows say what was accepted", () => {
    expect(skillsChanged(rows, ACCEPTED)).toBe(false);
  });

  it("sees no change when only the spacing around a skill moved", () => {
    const spaced = rows.map((row) => ({ ...row, skill: ` ${row.skill} ` }));

    expect(skillsChanged(spaced, ACCEPTED)).toBe(false);
  });

  it("sees a change when a skill was added", () => {
    expect(skillsChanged([...rows, newSkillEdit("Rust")], ACCEPTED)).toBe(true);
  });

  it("sees a change when a skill was removed", () => {
    expect(skillsChanged(rows.slice(0, 1), ACCEPTED)).toBe(true);
  });

  it("sees a change when a skill's wording was corrected", () => {
    const corrected = rows.map((row) =>
      row.skill === "Postgres" ? { ...row, skill: "PostgreSQL" } : row,
    );

    expect(skillsChanged(corrected, ACCEPTED)).toBe(true);
  });

  it("sees a change when two skills swapped places", () => {
    // The order is the user's: it is the order the model proposed them in, or
    // the order they typed them, and a list that came back reordered would
    // read as something having been done to it.
    expect(skillsChanged([...rows].reverse(), ACCEPTED)).toBe(true);
  });

  it("sees a change when the last skill was cleared away", () => {
    expect(skillsChanged([], ACCEPTED)).toBe(true);
  });

  it("sees no change when a Profile with no skills still has none", () => {
    expect(skillsChanged([], [])).toBe(false);
  });

  it("sees no change when an empty row was added but never typed into", () => {
    expect(skillsChanged([...rows, newSkillEdit("")], ACCEPTED)).toBe(false);
  });
});
