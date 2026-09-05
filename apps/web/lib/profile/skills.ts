import { Skill, SKILL_LIST_LIMIT, type SkillList } from "./contract";

/**
 * What a skill list is tidied to before it is anybody's. The model's proposal
 * and the user's own edit both come through here, so that an accepted list
 * cannot hold something a proposed one would have dropped — and so that the
 * rule lives in one readable function rather than in two endpoints.
 */

/**
 * The list, as it is worth keeping: each skill trimmed and its inner
 * whitespace collapsed, anything the contract would not call a Skill gone, no
 * skill twice, in the order it was given.
 *
 * Two skills are the same when they differ only in case and spacing. Nothing
 * further is folded together here — "Node" and "Node.js" may well be one
 * skill, but the deliberate decision in the spec is that no alias table and no
 * taxonomy exist anywhere in this product, and the Analysis is the escape
 * hatch for everything a comparison cannot see. A tidier that guessed would
 * quietly lose a skill the user typed on purpose.
 *
 * What it drops rather than refuses is the model's problem, not the user's:
 * the contract has already turned an unacceptable list from a user into a 400
 * naming the field, so by the time a proposal is dropped here it is a sentence
 * the model called a skill, and the review the user is about to do is better
 * without it.
 */
export function tidySkills(skills: string[]): SkillList {
  const kept = new Map<string, string>();

  for (const skill of skills) {
    // The contract's own rule, so that what is proposed is what an accepted
    // list may hold: a list shown for review must not contain something the
    // request accepting it would be refused for.
    const read = Skill.safeParse(skill.replace(/\s+/g, " "));
    if (!read.success) continue;
    const named = read.data;

    // The first spelling wins: it is the one the user typed, or the one the
    // model led with, and neither is improved by a later duplicate's casing.
    const same = named.toLocaleLowerCase();
    if (!kept.has(same)) kept.set(same, named);
  }

  return [...kept.values()].slice(0, SKILL_LIST_LIMIT);
}
