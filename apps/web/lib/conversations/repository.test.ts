import { CreateJobApplication } from "@repo/schema";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../db/client";
import { conversations } from "../db/schema";
import {
  createJobApplication,
  deleteJobApplication,
} from "../job-applications/repository";
import { OTHER_TEST_USER, TEST_USER } from "../test-support/users";
import {
  appendMessage,
  clearConversation,
  conversationFor,
  deleteConversation,
  messagesIn,
} from "./repository";

/**
 * The Conversation store as every caller sees it. Real rows in the real
 * database — there is no local stack (ADR-0003) — cleared around each test.
 *
 * What is worth proving here is the part that is not obvious from the
 * function names: that there are two kinds of Conversation and no more, that
 * one user's Conversation is never another's, that clearing and deleting are
 * genuinely different acts, and that a Job Application takes its Conversation
 * with it when it goes.
 */

const GENERAL = null;

beforeEach(forgetEverything);
afterAll(forgetEverything);

async function forgetEverything(): Promise<void> {
  for (const user of [TEST_USER, OTHER_TEST_USER]) {
    const general = await conversationFor(user.id, GENERAL);
    await deleteConversation(user.id, general.id);
  }
}

/** A Job Application to attach a Conversation to, taken away afterwards. */
async function withJobApplication(
  test: (id: string) => Promise<void>,
): Promise<void> {
  const created = await createJobApplication(TEST_USER.id, aJobApplication());
  try {
    await test(created.id);
  } finally {
    await deleteJobApplication(TEST_USER.id, created.id);
  }
}

/**
 * Through the contract rather than around it, so the row these tests attach a
 * Conversation to is the row the endpoint would have written.
 */
function aJobApplication(): CreateJobApplication {
  return CreateJobApplication.parse({
    company: "Acme",
    jobTitle: "Engineer",
    requirements: [],
  });
}

describe("finding a Conversation", () => {
  it("creates the general one the first time it is asked for", async () => {
    const conversation = await conversationFor(TEST_USER.id, GENERAL);

    expect(conversation.jobApplicationId).toBeNull();
    expect(conversation.userId).toBe(TEST_USER.id);
  });

  it("answers with the same general Conversation every time after", async () => {
    const first = await conversationFor(TEST_USER.id, GENERAL);
    const second = await conversationFor(TEST_USER.id, GENERAL);

    // Two kinds and no more: there is never a second general Conversation to
    // choose between, which is what makes standing somewhere enough to say
    // which Conversation the user is in.
    expect(second.id).toBe(first.id);
  });

  it("gives each user their own general Conversation", async () => {
    const mine = await conversationFor(TEST_USER.id, GENERAL);
    const theirs = await conversationFor(OTHER_TEST_USER.id, GENERAL);

    expect(theirs.id).not.toBe(mine.id);
  });

  it("gives a Job Application its own, apart from the general one", async () => {
    await withJobApplication(async (jobApplicationId) => {
      const attached = await conversationFor(TEST_USER.id, jobApplicationId);
      const general = await conversationFor(TEST_USER.id, GENERAL);

      expect(attached.jobApplicationId).toBe(jobApplicationId);
      expect(attached.id).not.toBe(general.id);
      expect((await conversationFor(TEST_USER.id, jobApplicationId)).id).toBe(
        attached.id,
      );
    });
  });
});

describe("two kinds and no more", () => {
  /**
   * These two reach past the repository and insert directly, which nothing in
   * the app does. That is the point: `conversationFor` reads before it writes,
   * so it would go on answering correctly with the indexes dropped, and the
   * checklist asks for a rule the database keeps rather than one the code
   * remembers. The only way to assert that is to try the write it refuses.
   */

  it("refuses a second general Conversation for one user", async () => {
    await conversationFor(TEST_USER.id, GENERAL);

    await expect(
      db().insert(conversations).values({ userId: TEST_USER.id }),
    ).rejects.toThrow();
  });

  it("refuses a second Conversation on one Job Application", async () => {
    await withJobApplication(async (jobApplicationId) => {
      await conversationFor(TEST_USER.id, jobApplicationId);

      await expect(
        db()
          .insert(conversations)
          .values({ userId: TEST_USER.id, jobApplicationId }),
      ).rejects.toThrow();
    });
  });

  it("lets another user have a general Conversation of their own", async () => {
    await conversationFor(TEST_USER.id, GENERAL);

    await expect(
      db().insert(conversations).values({ userId: OTHER_TEST_USER.id }),
    ).resolves.not.toThrow();
  });
});

describe("the Messages in a Conversation", () => {
  it("start empty", async () => {
    const { id } = await conversationFor(TEST_USER.id, GENERAL);

    expect(await messagesIn(TEST_USER.id, id)).toEqual([]);
  });

  it("read back oldest first, whoever said them", async () => {
    const { id } = await conversationFor(TEST_USER.id, GENERAL);

    await appendMessage(TEST_USER.id, id, { role: "user", text: "First." });
    await appendMessage(TEST_USER.id, id, { role: "model", text: "Second." });
    await appendMessage(TEST_USER.id, id, { role: "user", text: "Third." });

    expect(
      (await messagesIn(TEST_USER.id, id)).map(({ role, text }) => [
        role,
        text,
      ]),
    ).toEqual([
      ["user", "First."],
      ["model", "Second."],
      ["user", "Third."],
    ]);
  });

  it("keeps the empty text a reply that failed at once left behind", async () => {
    const { id } = await conversationFor(TEST_USER.id, GENERAL);

    const said = await appendMessage(TEST_USER.id, id, {
      role: "model",
      text: "",
    });

    expect(said.text).toBe("");
  });

  it("are nobody else's to read", async () => {
    const { id } = await conversationFor(TEST_USER.id, GENERAL);
    await appendMessage(TEST_USER.id, id, { role: "user", text: "Mine." });

    expect(await messagesIn(OTHER_TEST_USER.id, id)).toEqual([]);
  });

  it("are nobody else's to add to", async () => {
    const { id } = await conversationFor(TEST_USER.id, GENERAL);

    await expect(
      appendMessage(OTHER_TEST_USER.id, id, { role: "user", text: "Theirs." }),
    ).rejects.toThrow();
    expect(await messagesIn(TEST_USER.id, id)).toEqual([]);
  });
});

describe("clearing a Conversation", () => {
  it("empties it and keeps the Conversation itself", async () => {
    const before = await conversationFor(TEST_USER.id, GENERAL);
    await appendMessage(TEST_USER.id, before.id, {
      role: "user",
      text: "A line of thinking that went nowhere.",
    });

    await clearConversation(TEST_USER.id, before.id);

    expect(await messagesIn(TEST_USER.id, before.id)).toEqual([]);
    // The same row, not a replacement: clearing empties, and deleting removes.
    expect((await conversationFor(TEST_USER.id, GENERAL)).id).toBe(before.id);
  });

  it("is nobody else's to do", async () => {
    const { id } = await conversationFor(TEST_USER.id, GENERAL);
    await appendMessage(TEST_USER.id, id, { role: "user", text: "Mine." });

    await clearConversation(OTHER_TEST_USER.id, id);

    expect(await messagesIn(TEST_USER.id, id)).toHaveLength(1);
  });
});

describe("deleting a Conversation", () => {
  it("takes the Conversation and its Messages away together", async () => {
    const { id } = await conversationFor(TEST_USER.id, GENERAL);
    await appendMessage(TEST_USER.id, id, { role: "user", text: "Said." });

    expect(await deleteConversation(TEST_USER.id, id)).toBe(true);

    // Asked for again, it is a new row rather than the old one read back.
    expect((await conversationFor(TEST_USER.id, GENERAL)).id).not.toBe(id);
  });

  it("is nobody else's to do", async () => {
    const { id } = await conversationFor(TEST_USER.id, GENERAL);

    expect(await deleteConversation(OTHER_TEST_USER.id, id)).toBe(false);
    expect((await conversationFor(TEST_USER.id, GENERAL)).id).toBe(id);
  });
});

describe("a deleted Job Application", () => {
  it("takes its Conversation and that Conversation's Messages with it", async () => {
    const created = await createJobApplication(TEST_USER.id, aJobApplication());
    const attached = await conversationFor(TEST_USER.id, created.id);
    await appendMessage(TEST_USER.id, attached.id, {
      role: "user",
      text: "About this job.",
    });

    await deleteJobApplication(TEST_USER.id, created.id);

    expect(await messagesIn(TEST_USER.id, attached.id)).toEqual([]);
    expect(await deleteConversation(TEST_USER.id, attached.id)).toBe(false);
  });

  it("leaves the general Conversation alone", async () => {
    const general = await conversationFor(TEST_USER.id, GENERAL);
    await appendMessage(TEST_USER.id, general.id, {
      role: "user",
      text: "About the pipeline.",
    });
    const created = await createJobApplication(TEST_USER.id, aJobApplication());
    await conversationFor(TEST_USER.id, created.id);

    await deleteJobApplication(TEST_USER.id, created.id);

    expect(await messagesIn(TEST_USER.id, general.id)).toHaveLength(1);
  });
});
