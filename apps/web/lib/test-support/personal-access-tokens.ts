import type { CurrentUser } from "../auth/current-user";
import {
  createPersonalAccessToken,
  deletePersonalAccessToken,
  revokePersonalAccessToken,
} from "../personal-access-tokens/repository";
import {
  generatePersonalAccessToken,
  hashPersonalAccessToken,
} from "../personal-access-tokens/token";

/**
 * How a test signs in. The API tests address the API the way the extension
 * does — a Bearer Personal Access Token, which is a row in a table this
 * project owns — so Supabase Auth never enters the test path and the whole API
 * is proved reachable without it.
 *
 * Tokens issued here are removed rather than revoked when the file is done:
 * revocation is soft by design, and a test that only revoked would leave a row
 * behind on every run.
 */

/** A token a test can use, and take back. */
export type TestToken = {
  token: string;
  revoke: () => Promise<void>;
};

/** One token per user per test file, so a run does not issue dozens. */
const forUser = new Map<string, string>();
const issued: { userId: string; id: string }[] = [];

export async function issueTestToken(
  user: CurrentUser,
  name = "API tests",
): Promise<TestToken> {
  const token = generatePersonalAccessToken();
  const created = await createPersonalAccessToken(user.id, {
    name,
    tokenHash: hashPersonalAccessToken(token),
  });
  issued.push({ userId: user.id, id: created.id });

  return {
    token,
    revoke: async () => {
      await revokePersonalAccessToken(user.id, created.id);
    },
  };
}

/** The headers a request carries to be answered as this user. */
export async function bearer(
  user: CurrentUser,
): Promise<Record<string, string>> {
  const existing = forUser.get(user.id);
  if (existing !== undefined) return { authorization: `Bearer ${existing}` };

  const { token } = await issueTestToken(user);
  forUser.set(user.id, token);
  return { authorization: `Bearer ${token}` };
}

/** Takes every token this file issued away again. Call it once, at the end. */
export async function forgetTestTokens(): Promise<void> {
  forUser.clear();
  for (const { userId, id } of issued.splice(0)) {
    await deletePersonalAccessToken(userId, id);
  }
}
