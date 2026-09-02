import type { CurrentUser } from "../auth/current-user";

/**
 * Who the API tests act as. These are literal identifiers rather than accounts
 * in Supabase Auth: no column carries a foreign key into the auth schema, so a
 * test needs an identifier, not a session — and a fixed one can never be the
 * human's own account or the Playwright user's, which is what keeps a test run
 * away from real Job Applications.
 *
 * The second user exists so that per-user scoping has something real to be
 * proved against.
 */
export const TEST_USER: CurrentUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "api-tests@job-tracker.test",
};

export const OTHER_TEST_USER: CurrentUser = {
  id: "00000000-0000-4000-8000-000000000002",
  email: "other-api-tests@job-tracker.test",
};
