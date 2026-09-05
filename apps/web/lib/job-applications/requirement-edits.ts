import type {
  JobApplication,
  Requirement,
  RequirementWithCoverage,
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
 * for as long as the form is open, and is not the Requirement's own id: a row
 * the user has just typed has no id until the page is saved, and editing
 * "Ruby" into "Rust" would otherwise look to React like a different
 * Requirement arriving in the same place.
 *
 * The id is what the server knows the Requirement by, and is null for exactly
 * as long as the server has never heard of it — which is what the override
 * control reads to know whether there is anything yet to override.
 */
export type RequirementEdit = Omit<RequirementWithCoverage, "id"> & {
  key: string;
  id: string | null;
};

/** What a Requirement nothing has been read against yet carries. */
const NOTHING_READ = {
  coverage: null,
  normalisedCoverage: null,
  analysedCoverage: null,
  analysedReason: null,
  overriddenCoverage: null,
} satisfies Omit<RequirementWithCoverage, "id" | "skill" | "necessity">;

/**
 * A Job Application's Requirements, as rows ready to be corrected. The rows
 * carry the Coverage readings along with the wording, because the badge sits
 * on the row it belongs to and is read while the row is being edited.
 */
export function requirementEditsFrom(
  requirements: RequirementWithCoverage[],
): RequirementEdit[] {
  return requirements.map((requirement) => ({
    key: crypto.randomUUID(),
    ...requirement,
  }));
}

/**
 * A row for a Requirement the user has just typed. It carries no readings, and
 * the badge shows nothing rather than "missing": nothing has compared it to
 * anything yet, and it will not have been until the page is saved. Its id is
 * null for the same reason — there is no row to address until then.
 */
export function newRequirementEdit(requirement: Requirement): RequirementEdit {
  const { skill, necessity } = requirement;
  return {
    key: crypto.randomUUID(),
    id: null,
    skill,
    necessity,
    ...NOTHING_READ,
  };
}

/**
 * The row as it reads once a Coverage has been written to it. The readings are
 * the server's and are taken whole; the wording stays the row's, because the
 * user may be part-way through correcting a skill whose verdict they have just
 * overruled, and a write that answered about the Requirement should not reach
 * back into the box they are typing in.
 */
export function withReadings(
  edit: RequirementEdit,
  requirement: RequirementWithCoverage,
): RequirementEdit {
  return {
    ...edit,
    coverage: requirement.coverage,
    normalisedCoverage: requirement.normalisedCoverage,
    analysedCoverage: requirement.analysedCoverage,
    analysedReason: requirement.analysedReason,
    overriddenCoverage: requirement.overriddenCoverage,
  };
}

/**
 * What the rows say, as the contract states a Requirement. A skill is trimmed
 * so a stray space is not a correction, and an emptied one is kept rather than
 * dropped, so that `UpdateJobApplication` gets to name the problem instead of
 * this silently throwing away a Requirement the user meant to rename.
 */
export function asRequirements(
  edits: readonly RequirementEdit[],
): Requirement[] {
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
  edits: readonly RequirementEdit[],
  saved: JobApplication,
): Pick<UpdateJobApplication, "requirements"> {
  const asked = asRequirements(edits);
  return sameRequirements(asked, saved.requirements)
    ? {}
    : { requirements: asked };
}

/**
 * Whether two lists ask for the same things, in the same order, as badly. The
 * Coverage readings are no part of it: they are what a CV answers back rather
 * than something the user is correcting, and a patch never states them.
 */
function sameRequirements(
  one: readonly Requirement[],
  other: readonly Requirement[],
): boolean {
  return (
    one.length === other.length &&
    one.every(
      (requirement, index) =>
        requirement.skill === other[index]?.skill &&
        requirement.necessity === other[index]?.necessity,
    )
  );
}
