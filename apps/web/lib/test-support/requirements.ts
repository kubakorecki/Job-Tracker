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
