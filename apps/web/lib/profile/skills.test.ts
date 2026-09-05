import { describe, expect, it } from "vitest";
import { SKILL_LIST_LIMIT } from "./contract";
import { tidySkills } from "./skills";

/**
 * The one decision a skill list makes on its own, wherever it came from: the
 * model's proposal and the user's own edit are tidied by the same function, so
 * that an accepted list cannot hold something a proposed one would have
 * dropped.
 */

describe("tidying a skill list", () => {
  it("keeps the skills in the order they were given", () => {
    expect(tidySkills(["TypeScript", "Postgres", "Terraform"])).toEqual([
      "TypeScript",
      "Postgres",
      "Terraform",
    ]);
  });

  it("trims each skill, so a stray space is not part of the name", () => {
    expect(tidySkills(["  TypeScript  "])).toEqual(["TypeScript"]);
  });

  it("collapses the whitespace inside a skill", () => {
    expect(tidySkills(["Amazon   Web\tServices"])).toEqual([
      "Amazon Web Services",
    ]);
  });

  it("drops a skill that was only ever whitespace", () => {
    expect(tidySkills(["TypeScript", "", "   ", "Postgres"])).toEqual([
      "TypeScript",
      "Postgres",
    ]);
  });

  it("keeps one of two skills that differ only in case, in the first spelling", () => {
    expect(tidySkills(["TypeScript", "typescript", "TYPESCRIPT"])).toEqual([
      "TypeScript",
    ]);
  });

  it("keeps skills that differ in more than case, because they are not the same skill", () => {
    // No taxonomy and no synonyms anywhere in this product: "Node" and
    // "Node.js" may well be one skill, and the Analysis is the escape hatch
    // for everything a comparison cannot see.
    expect(tidySkills(["Node", "Node.js"])).toEqual(["Node", "Node.js"]);
  });

  it("drops what the contract would not call a skill at all", () => {
    // A sentence the model called a skill. Dropping it is what keeps the
    // proposal a list the accept request would not be refused for; a user
    // could never send one this long, because the contract refuses it first.
    const sentence = "x".repeat(121);

    expect(tidySkills(["Go", sentence])).toEqual(["Go"]);
  });

  it("takes only as many skills as a list may hold", () => {
    const many = Array.from(
      { length: SKILL_LIST_LIMIT + 5 },
      (_, i) => `S${i}`,
    );

    expect(tidySkills(many)).toHaveLength(SKILL_LIST_LIMIT);
    expect(tidySkills(many)[0]).toBe("S0");
  });

  it("answers with nothing for a list of nothing", () => {
    expect(tidySkills([])).toEqual([]);
  });
});
