/**
 * The skill list's arithmetic, kept apart from the controls that render it: a
 * Profile's skills as rows a column of boxes can hold, and what those rows
 * amount to when the user says the list is right.
 *
 * One module serves both lists the Profile page shows. The Draft the model
 * proposed and the list the user accepted weeks ago are the same shape being
 * corrected in the same way, and the endpoint behind them is one endpoint
 * (`PUT /api/profile/skills`) for the same reason: accepting a proposal is
 * saying what the list should be, which is all an edit ever is.
 *
 * It sits beside `./skills` rather than inside it because the two answer
 * different questions. `tidySkills` decides what a list may hold and runs on
 * the server for the proposal and the edit alike; this decides what a screenful
 * of boxes says, and runs nowhere but the browser.
 */

/**
 * One skill while it is being corrected. The key is the row's identity for as
 * long as the page is open: a Skill has no identity beyond its own wording,
 * and its wording is precisely what a correction changes — so without one,
 * editing "Ruby" into "Rust" would look to React like a different row arriving
 * in the same place.
 */
export type SkillEdit = {
  key: string;
  skill: string;
};

/** A skill list, as rows ready to be corrected. */
export function skillEditsFrom(skills: string[]): SkillEdit[] {
  return skills.map((skill) => newSkillEdit(skill));
}

/** A row for a skill just typed, or an empty one to type into. */
export function newSkillEdit(skill: string): SkillEdit {
  return { key: crypto.randomUUID(), skill };
}

/**
 * What the rows say, in the order they say it. Each is trimmed, so a stray
 * space is not a correction, and an emptied one is dropped rather than sent:
 * a row here is one box and nothing else, so clearing it is how a skill is
 * taken away, not a half-filled record for the contract to complain about.
 *
 * Nothing else is done to the list. Two spellings of one skill are folded
 * together by `tidySkills`, on the server, where the model's proposal is
 * folded too — and a list too long for a Profile is left long, so the contract
 * gets to refuse it by name instead of this quietly dropping what it would not
 * have kept.
 */
export function asSkills(edits: SkillEdit[]): string[] {
  return edits.map(({ skill }) => skill.trim()).filter((skill) => skill !== "");
}

/**
 * Whether the rows say something other than the list they were opened on.
 * What tells "save this" apart from "nothing has changed" — and what keeps the
 * page from spending a request to write back exactly what is already there.
 */
export function skillsChanged(edits: SkillEdit[], saved: string[]): boolean {
  const said = asSkills(edits);

  return (
    said.length !== saved.length ||
    said.some((skill, index) => skill !== saved[index])
  );
}
