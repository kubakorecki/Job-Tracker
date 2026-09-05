import type {
  Necessity,
  Requirement,
  RequirementWithCoverage,
} from "@repo/schema";

/**
 * A Requirement in the shape a read answers with, for the tests that need a
 * Job Application to hold one without caring how it reads.
 *
 * Nothing has been read against it: no Profile, no Analysis, no override, and
 * therefore no Coverage. That is what a Requirement looks like to a user who
 * has not uploaded a CV, which makes it the honest default for a fixture that
 * is about something else entirely.
 */
export function asked(
  skill: string,
  necessity: Necessity,
  readings: Partial<Omit<RequirementWithCoverage, keyof Requirement>> = {},
): RequirementWithCoverage {
  return {
    // A Requirement read back carries the row's own id, which is how an
    // override addresses one. Nothing that uses this fixture cares which id it
    // is, only that it is one and that no two rows share it.
    id: crypto.randomUUID(),
    skill,
    necessity,
    coverage: null,
    normalisedCoverage: null,
    analysedCoverage: null,
    analysedReason: null,
    overriddenCoverage: null,
    ...readings,
  };
}
