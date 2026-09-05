import { afterEach, describe, expect, it } from "vitest";
import { getCurrentUser, type CurrentUser } from "../auth/current-user";
import { OTHER_TEST_USER, TEST_USER } from "../test-support/users";
import type {
  IssuedPersonalAccessToken,
  PersonalAccessToken,
} from "./contract";
import {
  createPersonalAccessTokenResponse,
  listPersonalAccessTokensResponse,
  revokePersonalAccessTokenResponse,
} from "./api";
import { deletePersonalAccessToken } from "./repository";

/**
 * The Personal Access Token endpoints, and the credential they produce, as a
 * client sees them: what the API hands back, what it refuses, and whether the
 * token then works. Nothing here reads the tokens table directly except the
 * delete that takes these rows away again — revocation is soft, so a test that
 * did not clean up would leave its trace behind for good.
 */

const ENDPOINT = "https://job-tracker.test/api/personal-access-tokens";

/** Everything this file has issued, so it can be taken away again. */
const issued: { userId: string; id: string }[] = [];

afterEach(async () => {
  for (const { userId, id } of issued.splice(0)) {
    await deletePersonalAccessToken(userId, id);
  }
});

async function create(user: CurrentUser, body: unknown): Promise<Response> {
  const response = await createPersonalAccessTokenResponse(
    new Request(ENDPOINT, { method: "POST", body: JSON.stringify(body) }),
    user,
  );

  if (response.status === 201) {
    const token: IssuedPersonalAccessToken = await response.clone().json();
    issued.push({ userId: user.id, id: token.id });
  }

  return response;
}

/** Issues a token, failing loudly if it could not be issued. */
async function issue(
  user: CurrentUser,
  name: string,
): Promise<IssuedPersonalAccessToken> {
  const response = await create(user, { name });
  expect(response.status).toBe(201);
  return response.json();
}

async function list(user: CurrentUser): Promise<Response> {
  return listPersonalAccessTokensResponse(new Request(ENDPOINT), user);
}

async function tokensOf(user: CurrentUser): Promise<PersonalAccessToken[]> {
  return (await list(user)).json();
}

async function revoke(user: CurrentUser, id: string): Promise<Response> {
  return revokePersonalAccessTokenResponse(
    new Request(`${ENDPOINT}/${id}`, { method: "DELETE" }),
    user,
    { id },
  );
}

/** A request the way the extension makes one: a token, and no cookie at all. */
function presenting(token: string): Request {
  return new Request("https://job-tracker.test/api/job-applications", {
    headers: { authorization: `Bearer ${token}` },
  });
}

/** An id shaped like a Personal Access Token's, belonging to none. */
const NO_SUCH_ID = "00000000-0000-4000-8000-00000000beef";

describe("POST /api/personal-access-tokens", () => {
  it("shows the raw token exactly once, on creation", async () => {
    const token = await issue(TEST_USER, "Laptop");

    expect(token.token).toEqual(expect.any(String));
    expect(token).toMatchObject({
      name: "Laptop",
      lastUsedAt: null,
      revokedAt: null,
    });
    expect(token.createdAt).toEqual(expect.any(String));
  });

  it("never hands the raw token, or its hash, back again", async () => {
    const token = await issue(TEST_USER, "Laptop");

    const listed = await tokensOf(TEST_USER);
    const mine = listed.find(({ id }) => id === token.id);

    expect(mine).toBeDefined();
    expect(JSON.stringify(listed)).not.toContain(token.token);
    expect(mine).not.toHaveProperty("token");
    expect(mine).not.toHaveProperty("tokenHash");
  });

  it("names each token, so one machine's is distinguishable from another's", async () => {
    const laptop = await issue(TEST_USER, "Laptop");
    const desktop = await issue(TEST_USER, "Desktop");

    expect(laptop.token).not.toBe(desktop.token);

    const names = (await tokensOf(TEST_USER))
      .filter(({ id }) => id === laptop.id || id === desktop.id)
      .map(({ name }) => name);
    expect(names).toEqual(expect.arrayContaining(["Laptop", "Desktop"]));
  });

  it("refuses a token with no name", async () => {
    const response = await create(TEST_USER, { name: "" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      issues: expect.arrayContaining([expect.stringContaining("name")]),
    });
  });

  it("refuses a body that is not JSON", async () => {
    const response = await createPersonalAccessTokenResponse(
      new Request(ENDPOINT, { method: "POST", body: "not json" }),
      TEST_USER,
    );

    expect(response.status).toBe(400);
  });
});

describe("GET /api/personal-access-tokens", () => {
  it("lists a token's name, when it was created and when it was last used", async () => {
    const token = await issue(TEST_USER, "Laptop");

    const response = await list(TEST_USER);
    const listed: PersonalAccessToken[] = await response.json();

    expect(response.status).toBe(200);
    expect(listed.find(({ id }) => id === token.id)).toEqual({
      id: token.id,
      name: "Laptop",
      createdAt: token.createdAt,
      lastUsedAt: null,
      revokedAt: null,
    });
  });

  it("never returns another user's tokens", async () => {
    const mine = await issue(TEST_USER, "Mine");
    const theirs = await issue(OTHER_TEST_USER, "Theirs");

    const forMe = (await tokensOf(TEST_USER)).map(({ id }) => id);

    expect(forMe).toContain(mine.id);
    expect(forMe).not.toContain(theirs.id);
  });
});

describe("a Bearer Personal Access Token", () => {
  it("identifies the user who issued it, with no session anywhere", async () => {
    const token = await issue(TEST_USER, "Laptop");

    await expect(
      getCurrentUser(presenting(token.token)),
    ).resolves.toMatchObject({
      id: TEST_USER.id,
    });
  });

  it("records when it was last used", async () => {
    const token = await issue(TEST_USER, "Laptop");
    expect(token.lastUsedAt).toBeNull();

    await getCurrentUser(presenting(token.token));

    const [used] = (await tokensOf(TEST_USER)).filter(
      ({ id }) => id === token.id,
    );
    expect(used?.lastUsedAt).not.toBeNull();
  });

  it("identifies nobody when it was never issued", async () => {
    await expect(
      getCurrentUser(presenting("pat_neverissued_0000000000000000000000")),
    ).resolves.toBeNull();
  });

  it("identifies nobody once it has been revoked, however it is presented", async () => {
    const token = await issue(TEST_USER, "Lost laptop");
    await revoke(TEST_USER, token.id);

    await expect(getCurrentUser(presenting(token.token))).resolves.toBeNull();
    // The scheme is matched without regard to case, the way a client may send it.
    await expect(
      getCurrentUser(
        new Request("https://job-tracker.test/api/job-applications", {
          headers: { authorization: `bearer ${token.token}` },
        }),
      ),
    ).resolves.toBeNull();
  });
});

describe("DELETE /api/personal-access-tokens/:id", () => {
  it("stops the token working on the very next request", async () => {
    const token = await issue(TEST_USER, "Lost laptop");
    await expect(
      getCurrentUser(presenting(token.token)),
    ).resolves.not.toBeNull();

    const response = await revoke(TEST_USER, token.id);

    expect(response.status).toBe(200);
    await expect(getCurrentUser(presenting(token.token))).resolves.toBeNull();
  });

  it("revokes softly, so the row survives as a trace", async () => {
    const token = await issue(TEST_USER, "Lost laptop");

    await revoke(TEST_USER, token.id);

    const revoked = (await tokensOf(TEST_USER)).find(
      ({ id }) => id === token.id,
    );
    expect(revoked).toMatchObject({ name: "Lost laptop" });
    expect(revoked?.revokedAt).not.toBeNull();
  });

  it("never revokes another user's token", async () => {
    const theirs = await issue(OTHER_TEST_USER, "Theirs");

    const response = await revoke(TEST_USER, theirs.id);

    expect(response.status).toBe(404);
    await expect(
      getCurrentUser(presenting(theirs.token)),
    ).resolves.not.toBeNull();
  });

  it("refuses to revoke the same token twice", async () => {
    const token = await issue(TEST_USER, "Laptop");
    await revoke(TEST_USER, token.id);

    const again = await revoke(TEST_USER, token.id);

    expect(again.status).toBe(404);
  });

  it("refuses a token that does not exist", async () => {
    expect((await revoke(TEST_USER, NO_SUCH_ID)).status).toBe(404);
  });

  it("refuses an id that could never be a token's", async () => {
    expect((await revoke(TEST_USER, "not-a-uuid")).status).toBe(404);
  });
});
