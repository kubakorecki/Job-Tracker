import { CreateJobApplication, type JobStatus } from "@repo/schema";
import { afterEach, describe, expect, it } from "vitest";
import {
  createJobApplication,
  deleteJobApplication,
  updateJobApplication,
} from "../job-applications/repository";
import { OTHER_TEST_USER, TEST_USER } from "../test-support/users";
import { statusChangesFor } from "./repository";

/**
 * The history behind a Status. Real rows in the real database — there is no
 * local stack (ADR-0003) — written through the Job Application repository,
 * because that is the only thing that writes them: the detail view, the
 * board's drag, the table, the form and the extension all reach a Status
 * through `createJobApplication` or `updateJobApplication`, so a move recorded
 * here is a move recorded from all five.
 *
 * What is worth proving is the part that is not obvious from the function
 * names: that being saved somewhere counts as arriving there, that a write
 * which moves nothing records nothing, that a move back is its own row, and
 * that one user's history is never another's.
 */

/** Everything this file has written, so it can be taken away again. */
const saved: { userId: string; id: string }[] = [];

afterEach(async () => {
  // No test may assume an empty database, so each one leaves it as it found it.
  for (const { userId, id } of saved.splice(0)) {
    await deleteJobApplication(userId, id);
  }
});

/**
 * Through the contract rather than around it, so the Job Application these
 * tests move is the row the endpoint would have written.
 */
async function save(
  user = TEST_USER,
  status: JobStatus = "bookmarked",
): Promise<string> {
  const created = await createJobApplication(
    user.id,
    CreateJobApplication.parse({
      company: "Acme",
      jobTitle: "Engineer",
      status,
    }),
  );

  saved.push({ userId: user.id, id: created.id });
  return created.id;
}

/** One Job Application's history as the Statuses it records, in order. */
async function historyOf(id: string, user = TEST_USER): Promise<JobStatus[]> {
  const changes = await statusChangesFor(user.id, id);
  return changes.map((change) => change.status);
}

async function moveTo(id: string, status: JobStatus): Promise<void> {
  await updateJobApplication(TEST_USER.id, id, { status });
}

describe("creating a Job Application", () => {
  it("records the Status it was saved at", async () => {
    // What an extension save that lands in `applied` is: the Job Application
    // did not move there, it arrived there, and that is how it came to stand
    // where it does.
    const id = await save(TEST_USER, "applied");

    expect(await historyOf(id)).toEqual(["applied"]);
  });

  it("records a bookmark too", async () => {
    const id = await save(TEST_USER, "bookmarked");

    expect(await historyOf(id)).toEqual(["bookmarked"]);
  });
});

describe("moving a Job Application", () => {
  it("records one row per move, in the order they happened", async () => {
    const id = await save(TEST_USER, "bookmarked");

    await moveTo(id, "applied");
    await moveTo(id, "interviewing");
    await moveTo(id, "offer");

    expect(await historyOf(id)).toEqual([
      "bookmarked",
      "applied",
      "interviewing",
      "offer",
    ]);
  });

  it("records a move back as a row of its own", async () => {
    const id = await save(TEST_USER, "bookmarked");

    await moveTo(id, "interviewing");
    await moveTo(id, "applied");

    // Not a correction of the row before it: both moves happened, and the
    // history says so (ADR-0010).
    expect(await historyOf(id)).toEqual([
      "bookmarked",
      "interviewing",
      "applied",
    ]);
  });

  it("records nothing when the Status it is set to is the one it had", async () => {
    const id = await save(TEST_USER, "applied");

    await moveTo(id, "applied");

    // Setting a Status is not the same act as moving one; `updateJobApplication`
    // says why a write that moved nothing must record nothing.
    expect(await historyOf(id)).toEqual(["applied"]);
  });

  it("records nothing when the patch never named a Status", async () => {
    const id = await save(TEST_USER, "applied");

    await updateJobApplication(TEST_USER.id, id, { notes: "Rang back." });

    expect(await historyOf(id)).toEqual(["applied"]);
  });

  it("leaves the history alone when the Job Application is not this user's", async () => {
    const id = await save(TEST_USER, "bookmarked");

    await updateJobApplication(OTHER_TEST_USER.id, id, { status: "rejected" });

    // The patch moved nothing, because it matched no row of that user's — so
    // there is nothing for it to have recorded either.
    expect(await historyOf(id)).toEqual(["bookmarked"]);
  });
});

describe("reading a history", () => {
  it("answers with nothing for another user's Job Application", async () => {
    const id = await save(TEST_USER, "applied");

    // The same answer a stranger's row gets everywhere else: nothing, rather
    // than a hint that the Job Application is real.
    expect(await historyOf(id, OTHER_TEST_USER)).toEqual([]);
  });

  it("stamps each move with when it happened", async () => {
    const before = Date.now();
    const id = await save(TEST_USER, "bookmarked");
    await moveTo(id, "applied");

    const changes = await statusChangesFor(TEST_USER.id, id);
    const stamps = changes.map((change) => Date.parse(change.changedAt));

    expect(stamps).toHaveLength(2);
    for (const stamp of stamps) {
      // Loosely, because the stamp is the database's clock and not this
      // process's: what matters is that it is the moment of the move rather
      // than of anything read afterwards.
      expect(stamp).toBeGreaterThanOrEqual(before - 60_000);
      expect(stamp).toBeLessThanOrEqual(Date.now() + 60_000);
    }
  });
});

describe("deleting a Job Application", () => {
  it("takes its history with it", async () => {
    const id = await save(TEST_USER, "bookmarked");
    await moveTo(id, "applied");

    await deleteJobApplication(TEST_USER.id, id);
    saved.length = 0;

    // The one way a row ever disappears, and deliberate: ADR-0010's
    // Consequences are what withdrawing rather than deleting is for.
    expect(await historyOf(id)).toEqual([]);
  });
});
