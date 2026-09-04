/**
 * The other half of ADR-0002. A normalized URL says two saves are the same
 * Posting and the database refuses the second; nothing says the same about the
 * same role advertised in two places, and nothing here tries to. Fuzzy
 * matching on company and title produces false merges at companies that post
 * twenty near-identical roles, and a wrong merge silently destroys a record.
 *
 * So this answers a weaker question — "has the user got something like this
 * already?" — and its answer is a hint. The user decides.
 */

/** As much of a Job Application as the rule looks at. */
export type TitledRole = { company: string; jobTitle: string };

/**
 * The Job Applications the user may already have for this role. Empty when
 * either field is still blank: a half-typed form is not evidence of anything,
 * and a hint that appeared on the first keystroke would be noise.
 *
 * The rule is deliberately one sentence long — same company, and one title's
 * words all appear in the other's. It is loose in the safe direction, because
 * over-hinting costs a line of text and under-hinting costs a duplicate the
 * user did not notice.
 */
export function nearDuplicatesOf<Existing extends TitledRole>(
  role: TitledRole,
  jobApplications: readonly Existing[],
): Existing[] {
  const company = words(role.company);
  const title = words(role.jobTitle);

  if (company.length === 0 || title.length === 0) return [];

  const at = company.join(" ");

  return jobApplications.filter(
    (existing) =>
      words(existing.company).join(" ") === at &&
      alike(title, words(existing.jobTitle)),
  );
}

/**
 * Whether either title says everything the other does. "Software Engineer"
 * and "Senior Software Engineer" are one role written twice; "Backend
 * Engineer" and "Frontend Engineer" are two, and neither contains the other.
 */
function alike(one: string[], other: string[]): boolean {
  if (one.length === 0 || other.length === 0) return false;

  const [shorter, longer] =
    one.length <= other.length ? [one, other] : [other, one];

  const has = new Set(longer);
  return shorter.every((word) => has.has(word));
}

/**
 * A name as its words, so that spacing, case and the punctuation job boards
 * put around a qualifier — "Software Engineer (Backend)", "Software
 * Engineer, Backend" — do not make two ways of writing one name look like two
 * names. Anything that is not a letter or a digit separates.
 */
function words(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== "");
}
