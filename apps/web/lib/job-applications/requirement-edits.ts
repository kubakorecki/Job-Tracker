import type {
  JobApplication,
  Necessity,
  Requirement,
  UpdateJobApplication,
} from "@repo/schema";

/**
 * The Requirements section's arithmetic, kept apart from the controls that
 * render it: a Job Application's asks as rows a list of boxes can hold, and
 * the patch those rows amount to.
 *
 * It sits beside `./edits` rather than inside it because a Requirement is not
 * a box of text — it is a skill and a Necessity together, and a list of them
 * is added to and removed from rather than typed over.
 */

/**
 * One Requirement while it is being corrected. The key is the row's identity
 * for as long as the form is open: a Requirement has none in the contract —
 * the skill is what identifies it, and the skill is precisely what a
 * correction changes — so without one, editing "Ruby" into "Rust" would look
 * to React like a different Requirement arriving in the same place.
 */
export type RequirementEdit = {
  key: string;
  skill: string;
  necessity: Necessity;
};

/** A Job Application's Requirements, as rows ready to be corrected. */
export function requirementEditsFrom(
  requirements: Requirement[],
): RequirementEdit[] {
  return requirements.map((requirement) => newRequirementEdit(requirement));
}

/** A row for a Requirement that has not been saved yet, or has just been typed. */
export function newRequirementEdit(requirement: Requirement): RequirementEdit {
  return { key: crypto.randomUUID(), ...requirement };
}

/**
 * What the rows say, as the contract states a Requirement. A skill is trimmed
 * so a stray space is not a correction, and an emptied one is kept rather than
 * dropped, so that `UpdateJobApplication` gets to name the problem instead of
 * this silently throwing away a Requirement the user meant to rename.
 */
export function asRequirements(edits: RequirementEdit[]): Requirement[] {
  return edits.map(({ skill, necessity }) => ({
    skill: skill.trim(),
    necessity,
  }));
}

/**
 * The Requirements' half of a patch — either the whole list or nothing at all.
 * Nothing at all is what leaves them alone, and it matters that clearing the
 * last Requirement is not that: an empty list says the Posting asks nothing,
 * and the endpoint reads the difference.
 */
export function requirementChanges(
  edits: RequirementEdit[],
  saved: JobApplication,
): Pick<UpdateJobApplication, "requirements"> {
  const asked = asRequirements(edits);
  return sameRequirements(asked, saved.requirements)
    ? {}
    : { requirements: asked };
}

/** Whether two lists ask for the same things, in the same order, as badly. */
function sameRequirements(one: Requirement[], other: Requirement[]): boolean {
  return (
    one.length === other.length &&
    one.every(
      (requirement, index) =>
        requirement.skill === other[index]?.skill &&
        requirement.necessity === other[index]?.necessity,
    )
  );
}
